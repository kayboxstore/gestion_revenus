// @vitest-environment node

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe.sequential : describe.skip;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

type References = {
  householdId: string;
  iptvProduct: string;
  boxProduct: string;
  cashUsd: string;
  cashCdf: string;
  mpesaUsd: string;
  savingsUsd: string;
  familyCategory: string;
  savingsGoal: string;
};

const ownerId = randomUUID();
const readerId = randomUUID();
const otherOwnerId = randomUUID();
let refs: References;
let otherHouseholdId: string;

async function asUser<T>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!pool) throw new Error("TEST_DATABASE_URL is required");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims',$2,true)",
      [userId, JSON.stringify({ sub: userId, role: "authenticated" })],
    );
    await client.query("set local role authenticated");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function one<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await client.query<T>(sql, values);
  if (result.rowCount !== 1)
    throw new Error(`Expected one row, got ${result.rowCount}`);
  return result.rows[0];
}

async function record(
  client: PoolClient,
  input: {
    type: string;
    amount: string;
    currency?: string;
    rate?: string;
    description?: string;
    activity?: string | null;
    key?: string;
    payload?: Record<string, string>;
  },
) {
  return one<{ id: string }>(
    client,
    `select record_financial_operation(
      $1::uuid,$2::text,$3::numeric,$4::text,$5::numeric,$6::text,
      $7::text,$8::text,$9::jsonb
    ) as id`,
    [
      refs.householdId,
      input.type,
      input.amount,
      input.currency ?? "USD",
      input.rate ?? "1",
      input.description ?? `Test ${input.type}`,
      input.activity ?? null,
      input.key ?? randomUUID(),
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

databaseDescribe("real PostgreSQL financial and RLS acceptance", () => {
  beforeAll(async () => {
    if (!pool) return;
    const admin = await pool.connect();
    try {
      for (const [id, email] of [
        [ownerId, `owner-${ownerId}@example.test`],
        [readerId, `reader-${readerId}@example.test`],
        [otherOwnerId, `other-${otherOwnerId}@example.test`],
      ]) {
        await admin.query(
          `insert into auth.users(
            id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
            raw_app_meta_data,raw_user_meta_data,created_at,updated_at
          ) values(
            $1,'00000000-0000-0000-0000-000000000000','authenticated',
            'authenticated',$2,crypt('Test-password-1',gen_salt('bf')),now(),
            '{"provider":"email","providers":["email"]}','{}',now(),now()
          )`,
          [id, email],
        );
      }
    } finally {
      admin.release();
    }

    const household = await asUser(ownerId, (client) =>
      one<{ id: string }>(
        client,
        "select bootstrap_household('Foyer test','Propriétaire test') as id",
      ),
    );
    const otherHousehold = await asUser(otherOwnerId, (client) =>
      one<{ id: string }>(
        client,
        "select bootstrap_household('Autre foyer','Autre propriétaire') as id",
      ),
    );
    otherHouseholdId = otherHousehold.id;

    const adminMember = await pool.connect();
    try {
      await adminMember.query(
        "insert into household_members(household_id,user_id,role,status,joined_at) values($1,$2,'reader','active',now())",
        [household.id, readerId],
      );
    } finally {
      adminMember.release();
    }

    refs = await asUser(ownerId, async (client) => {
      const products = await client.query<{ id: string; sku: string }>(
        "select id,sku from products where household_id=$1",
        [household.id],
      );
      const accounts = await client.query<{ id: string; name: string }>(
        "select id,name from cash_accounts where household_id=$1",
        [household.id],
      );
      const familyCategory = await one<{ id: string }>(
        client,
        "select id from categories where household_id=$1 and type='family_expense' order by name limit 1",
        [household.id],
      );
      const goal = await one<{ id: string }>(
        client,
        "insert into savings_goals(household_id,name,target_amount,currency) values($1,'Urgences',500,'USD') returning id",
        [household.id],
      );
      const product = (sku: string) => {
        const found = products.rows.find((row) => row.sku === sku);
        if (!found) throw new Error(`Missing product ${sku}`);
        return found.id;
      };
      const account = (name: string) => {
        const found = accounts.rows.find((row) => row.name === name);
        if (!found) throw new Error(`Missing account ${name}`);
        return found.id;
      };
      return {
        householdId: household.id,
        iptvProduct: product("IPTV-STD"),
        boxProduct: product("ATV-BOX"),
        cashUsd: account("Caisse USD"),
        cashCdf: account("Caisse CDF"),
        mpesaUsd: account("M-Pesa USD"),
        savingsUsd: account("Épargne"),
        familyCategory: familyCategory.id,
        savingsGoal: goal.id,
      };
    });
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("posts an IPTV service sale without inventing stock or COGS", async () => {
    await asUser(ownerId, async (client) => {
      const entry = await record(client, {
        type: "cash_sale",
        amount: "12",
        activity: "IPTV",
        payload: {
          product_id: refs.iptvProduct,
          quantity: "1",
          source_cash_account_id: refs.cashUsd,
          operation_date: "2026-07-17",
        },
      });
      const lines = await one<{ count: string }>(
        client,
        "select count(*)::text as count from journal_lines where journal_entry_id=$1",
        [entry.id],
      );
      const movements = await one<{ count: string }>(
        client,
        "select count(*)::text as count from stock_movements where reference_id=(select id from sales where journal_entry_id=$1)",
        [entry.id],
      );
      expect(lines.count).toBe("2");
      expect(movements.count).toBe("0");
    });
  });

  it("calculates weighted-average stock and freezes COGS on a product sale", async () => {
    await asUser(ownerId, async (client) => {
      await record(client, {
        type: "stock_purchase",
        amount: "100",
        activity: "ANDROID_TV_BOX",
        payload: {
          product_id: refs.boxProduct,
          quantity: "4",
          source_cash_account_id: refs.cashUsd,
        },
      });
      await record(client, {
        type: "stock_purchase",
        amount: "60",
        activity: "ANDROID_TV_BOX",
        payload: {
          product_id: refs.boxProduct,
          quantity: "2",
          source_cash_account_id: refs.cashUsd,
        },
      });
      const before = await one<{
        quantity: string;
        weighted_unit_cost_base: string;
      }>(
        client,
        "select quantity::text,weighted_unit_cost_base::text from current_stock_balance($1,$2)",
        [refs.householdId, refs.boxProduct],
      );
      expect(before.quantity).toBe("6.0000");
      expect(before.weighted_unit_cost_base).toBe("26.6667");

      const sale = await record(client, {
        type: "cash_sale",
        amount: "100",
        activity: "ANDROID_TV_BOX",
        payload: {
          product_id: refs.boxProduct,
          quantity: "2",
          source_cash_account_id: refs.cashUsd,
        },
      });
      const item = await one<{ unit_price: string; unit_cost: string }>(
        client,
        "select unit_price::text,unit_cost::text from sale_items where sale_id=(select id from sales where journal_entry_id=$1)",
        [sale.id],
      );
      const after = await one<{
        quantity: string;
        weighted_unit_cost_base: string;
      }>(
        client,
        "select quantity::text,weighted_unit_cost_base::text from current_stock_balance($1,$2)",
        [refs.householdId, refs.boxProduct],
      );
      expect(item.unit_price).toBe("50.0000");
      expect(item.unit_cost).toBe("26.6667");
      expect(after.quantity).toBe("4.0000");
      expect(after.weighted_unit_cost_base).toBe("26.6667");
    });
  });

  it("rejects changed payloads on an idempotency retry", async () => {
    await asUser(ownerId, async (client) => {
      const key = randomUUID();
      const input = {
        type: "family_contribution",
        amount: "20",
        key,
        payload: { source_cash_account_id: refs.cashUsd },
      };
      const first = await record(client, input);
      const retry = await record(client, input);
      expect(retry.id).toBe(first.id);
      await expect(record(client, { ...input, amount: "21" })).rejects.toThrow(
        /idempotency key conflict/,
      );
    });
  });

  it("keeps expenses, transfers and savings out of revenue", async () => {
    await asUser(ownerId, async (client) => {
      const before = await one<{ revenue: string }>(
        client,
        "select revenue::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      await record(client, {
        type: "family_expense",
        amount: "8",
        payload: {
          category_id: refs.familyCategory,
          source_cash_account_id: refs.cashUsd,
        },
      });
      await record(client, {
        type: "transfer",
        amount: "10",
        payload: {
          source_cash_account_id: refs.cashUsd,
          destination_cash_account_id: refs.mpesaUsd,
        },
      });
      await record(client, {
        type: "savings_contribution",
        amount: "5",
        payload: {
          source_cash_account_id: refs.cashUsd,
          destination_cash_account_id: refs.savingsUsd,
          savings_goal_id: refs.savingsGoal,
        },
      });
      const after = await one<{
        revenue: string;
        family_expenses: string;
        savings: string;
      }>(
        client,
        "select revenue::text,family_expenses::text,savings::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      expect(after.revenue).toBe(before.revenue);
      expect(after.family_expenses).toBe("8.0000");
      expect(after.savings).toBe("5.0000");
    });
  });

  it("preserves both currencies and books the FX difference on a transfer", async () => {
    await asUser(ownerId, async (client) => {
      const entry = await record(client, {
        type: "transfer",
        amount: "100000",
        currency: "CDF",
        rate: "0.0004",
        payload: {
          source_cash_account_id: refs.cashCdf,
          destination_cash_account_id: refs.mpesaUsd,
          destination_amount_source: "39",
          destination_currency: "USD",
          destination_exchange_rate: "1",
        },
      });
      const totals = await one<{ debit: string; credit: string }>(
        client,
        "select sum(debit_base)::text as debit,sum(credit_base)::text as credit from journal_lines where journal_entry_id=$1",
        [entry.id],
      );
      const currencies = await client.query<{
        currency: string;
        source_amount: string;
      }>(
        "select currency,source_amount::text from journal_lines where journal_entry_id=$1 and cash_account_id is not null order by debit_base desc",
        [entry.id],
      );
      expect(totals.debit).toBe(totals.credit);
      expect(currencies.rows).toEqual([
        { currency: "USD", source_amount: "39.0000" },
        { currency: "CDF", source_amount: "100000.0000" },
      ]);
    });
  });

  it("blocks readers and prevents cross-household stock disclosure", async () => {
    await expect(
      asUser(readerId, (client) =>
        record(client, {
          type: "family_contribution",
          amount: "1",
          payload: { source_cash_account_id: refs.cashUsd },
        }),
      ),
    ).rejects.toThrow(/not allowed/);

    await asUser(readerId, async (client) => {
      const visible = await one<{ count: string }>(
        client,
        "select count(*)::text as count from households where id=$1",
        [otherHouseholdId],
      );
      expect(visible.count).toBe("0");
      await expect(
        client.query("select * from current_stock_balance($1,$2)", [
          otherHouseholdId,
          refs.boxProduct,
        ]),
      ).rejects.toThrow(/not allowed/);
    });
  });

  it("reverses with balanced cash-account trace and keeps posted lines immutable", async () => {
    await asUser(ownerId, async (client) => {
      const original = await record(client, {
        type: "family_contribution",
        amount: "30",
        payload: { source_cash_account_id: refs.cashUsd },
      });
      const reversal = await one<{ id: string }>(
        client,
        "select reverse_journal_entry($1,'Erreur de saisie') as id",
        [original.id],
      );
      const traces = await one<{
        original_count: string;
        reversal_count: string;
      }>(
        client,
        `select
          count(*) filter(where journal_entry_id=$1 and cash_account_id is not null)::text as original_count,
          count(*) filter(where journal_entry_id=$2 and cash_account_id is not null)::text as reversal_count
         from journal_lines where journal_entry_id in ($1,$2)`,
        [original.id, reversal.id],
      );
      expect(traces.reversal_count).toBe(traces.original_count);
      await expect(
        client.query(
          "update journal_lines set debit_base=debit_base+1 where journal_entry_id=$1",
          [reversal.id],
        ),
      ).rejects.toThrow(/immutable/);
    });
  });

  it("rejects direct posted journal and document writes", async () => {
    await asUser(ownerId, async (client) => {
      await expect(
        client.query(
          "insert into journal_entries(household_id,number,type,entry_date,status,created_by) values($1,$2,'manual',current_date,'posted',$3)",
          [refs.householdId, `DIRECT-${randomUUID()}`, ownerId],
        ),
      ).rejects.toThrow(/controlled RPC/);
    });
    await asUser(ownerId, async (client) => {
      await expect(
        client.query(
          `insert into expenses(
            household_id,category_id,cash_account_id,scope,expense_date,
            amount_source,amount_base,currency,status
          ) values($1,$2,$3,'family',current_date,1,1,'USD','posted')`,
          [refs.householdId, refs.familyCategory, refs.cashUsd],
        ),
      ).rejects.toThrow(/controlled RPC/);
    });
  });
});
