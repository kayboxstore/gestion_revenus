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
  iptvPlan: string;
  miniUpsProduct: string;
  boxProduct: string;
  cashUsd: string;
  cashCdf: string;
  mpesaUsd: string;
  savingsUsd: string;
  familyCategory: string;
  savingsGoal: string;
};

const ownerId = randomUUID();
const operatorId = randomUUID();
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

async function asAnon<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!pool) throw new Error("TEST_DATABASE_URL is required");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select set_config('request.jwt.claim.role','anon',true), set_config('request.jwt.claims',$1,true)",
      [JSON.stringify({ role: "anon" })],
    );
    await client.query("set local role anon");
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

function decimalToUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(4, "0").slice(0, 4)}`);
}

function decimalDelta(after: string, before: string): string {
  const delta = decimalToUnits(after) - decimalToUnits(before);
  const sign = delta < 0n ? "-" : "";
  const absolute = delta < 0n ? -delta : delta;
  const whole = absolute / 10000n;
  const fraction = (absolute % 10000n).toString().padStart(4, "0");
  return `${sign}${whole}.${fraction}`;
}

async function accountBalance(
  client: PoolClient,
  householdId: string,
  label: string,
): Promise<string> {
  const row = await one<{ amount: string }>(
    client,
    "select amount::text from get_account_balances($1) where label=$2",
    [householdId, label],
  );
  return row.amount;
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

async function recordIptv(
  client: PoolClient,
  input: {
    planId?: string;
    renewedFromId?: string | null;
    customerName?: string;
    customerPhone?: string | null;
    customerIdentifier?: string;
    activationDate?: string;
    paymentType?: "cash_sale" | "credit_sale";
    cashAccountId?: string | null;
    dueDate?: string | null;
    rate?: string;
    key?: string;
  },
) {
  return one<{ id: string }>(
    client,
    `select record_iptv_subscription_sale(
      $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::date,
      $8::text,$9::uuid,$10::date,$11::numeric,$12::text
    ) as id`,
    [
      refs.householdId,
      input.renewedFromId ?? null,
      input.planId ?? refs.iptvPlan,
      input.customerName ?? "Client IPTV test",
      input.customerPhone ?? "+243810000000",
      input.customerIdentifier ?? `iptv-${randomUUID()}`,
      input.activationDate ?? "2026-07-22",
      input.paymentType ?? "cash_sale",
      input.cashAccountId === undefined ? refs.cashUsd : input.cashAccountId,
      input.dueDate ?? null,
      input.rate ?? "1",
      input.key ?? randomUUID(),
    ],
  );
}

async function recordOpeningStock(
  client: PoolClient,
  input: {
    productId: string;
    quantity: string;
    totalValue: string;
    currency?: string;
    rate?: string;
    date?: string | null;
    description?: string;
    key?: string;
  },
) {
  return one<{ id: string }>(
    client,
    `select record_opening_stock(
      $1::uuid,$2::uuid,$3::numeric,$4::numeric,$5::text,$6::numeric,
      $7::date,$8::text,$9::text
    ) as id`,
    [
      refs.householdId,
      input.productId,
      input.quantity,
      input.totalValue,
      input.currency ?? "USD",
      input.rate ?? "1",
      input.date ?? null,
      input.description ?? "Stock initial test",
      input.key ?? randomUUID(),
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
        [operatorId, `operator-${operatorId}@example.test`],
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
        `insert into household_members(household_id,user_id,role,status,joined_at)
         values($1,$2,'reader','active',now()),($1,$3,'operator','active',now())`,
        [household.id, readerId, operatorId],
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
      const iptvPlan = await one<{ id: string }>(
        client,
        "select id from iptv_plans where household_id=$1 and active order by duration_days limit 1",
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
        iptvPlan: iptvPlan.id,
        miniUpsProduct: product("MINI-UPS"),
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

  it("atomically activates, renews and reverses an IPTV subscription term", async () => {
    await asUser(ownerId, async (client) => {
      const identifier = `kay-${randomUUID()}`;
      const activationKey = randomUUID();
      const activation = await recordIptv(client, {
        customerName: "Grâce Kayembe",
        customerPhone: "+243810203040",
        customerIdentifier: identifier,
        activationDate: "2026-07-22",
        key: activationKey,
      });
      const activated = await one<{
        activation_date: string;
        expiration_date: string;
        status: string;
        customer: string;
        sale_status: string;
        entry_status: string;
        entry_id: string;
        sale_id: string;
      }>(
        client,
        `select s.activation_date::text,s.expiration_date::text,s.status,
          c.name as customer,sa.status::text as sale_status,
          e.status::text as entry_status,e.id as entry_id,sa.id as sale_id
         from iptv_subscriptions s
         join contacts c on c.id=s.contact_id
         join sales sa on sa.id=s.sale_id
         join journal_entries e on e.id=s.journal_entry_id
         where s.id=$1`,
        [activation.id],
      );
      expect(activated).toMatchObject({
        activation_date: "2026-07-22",
        expiration_date: "2026-08-20",
        status: "active",
        customer: "Grâce Kayembe",
        sale_status: "paid",
        entry_status: "posted",
      });
      const activationTotals = await one<{ debit: string; credit: string }>(
        client,
        `select sum(debit_base)::text as debit,sum(credit_base)::text as credit
         from journal_lines where journal_entry_id=$1`,
        [activated.entry_id],
      );
      expect(activationTotals.debit).toBe("10.0000");
      expect(activationTotals.credit).toBe("10.0000");
      const serviceMovement = await one<{ count: string }>(
        client,
        "select count(*)::text as count from stock_movements where reference_id=$1",
        [activated.sale_id],
      );
      expect(serviceMovement.count).toBe("0");

      const activationRetry = await recordIptv(client, {
        customerName: "Grâce Kayembe",
        customerPhone: "+243810203040",
        customerIdentifier: identifier,
        activationDate: "2026-07-22",
        key: activationKey,
      });
      expect(activationRetry.id).toBe(activation.id);

      const renewalKey = randomUUID();
      const renewal = await recordIptv(client, {
        renewedFromId: activation.id,
        activationDate: "2026-08-15",
        paymentType: "credit_sale",
        cashAccountId: null,
        dueDate: "2026-08-25",
        key: renewalKey,
      });
      const renewed = await one<{
        activation_date: string;
        expiration_date: string;
        renewed_from_id: string;
        sale_status: string;
        due_date: string;
        entry_id: string;
      }>(
        client,
        `select s.activation_date::text,s.expiration_date::text,s.renewed_from_id,
          sa.status::text as sale_status,sa.due_date::text,e.id as entry_id
         from iptv_subscriptions s
         join sales sa on sa.id=s.sale_id
         join journal_entries e on e.id=s.journal_entry_id
         where s.id=$1`,
        [renewal.id],
      );
      expect(renewed).toMatchObject({
        activation_date: "2026-08-21",
        expiration_date: "2026-09-19",
        renewed_from_id: activation.id,
        sale_status: "confirmed",
        due_date: "2026-08-25",
      });
      const receivable = await one<{ debit: string }>(
        client,
        `select coalesce(sum(l.debit_base),0)::text as debit
         from journal_lines l join ledger_accounts a on a.id=l.ledger_account_id
         where l.journal_entry_id=$1 and a.code='receivable'`,
        [renewed.entry_id],
      );
      expect(receivable.debit).toBe("10.0000");

      const workspace = await one<{
        subscription_id: string;
        lifecycle_status: string;
        total_count: string;
      }>(
        client,
        `select subscription_id,lifecycle_status,total_count::text
         from get_iptv_subscriptions($1,'all',null,'2026-08-15',24,0)
         where customer_identifier=$2`,
        [refs.householdId, identifier],
      );
      expect(workspace).toEqual({
        subscription_id: renewal.id,
        lifecycle_status: "active",
        total_count: "1",
      });

      await expect(
        recordIptv(client, {
          renewedFromId: activation.id,
          activationDate: "2026-08-16",
          paymentType: "credit_sale",
          cashAccountId: null,
          dueDate: "2026-08-25",
          key: renewalKey,
        }),
      ).rejects.toThrow(/idempotency key conflict/);

      await one<{ id: string }>(
        client,
        "select reverse_journal_entry($1,'Correction abonnement test') as id",
        [renewed.entry_id],
      );
      const reversed = await one<{ status: string; sale_status: string }>(
        client,
        `select s.status,sa.status::text as sale_status
         from iptv_subscriptions s join sales sa on sa.id=s.sale_id where s.id=$1`,
        [renewal.id],
      );
      expect(reversed).toEqual({
        status: "cancelled",
        sale_status: "cancelled",
      });
    });
  });

  it("enforces IPTV role permissions and household isolation", async () => {
    await asUser(readerId, async (client) => {
      await expect(recordIptv(client, {})).rejects.toThrow(/not allowed/);
    });
    await asUser(otherOwnerId, async (client) => {
      await expect(
        one(client, "select * from get_iptv_overview($1,'2026-07-22')", [
          refs.householdId,
        ]),
      ).rejects.toThrow(/not allowed/);
    });
    await asUser(operatorId, async (client) => {
      const activation = await recordIptv(client, {
        customerName: "Client opérateur",
        customerIdentifier: `operator-${randomUUID()}`,
      });
      expect(activation.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it("records and reverses opening stock without changing cash or profit", async () => {
    await asUser(ownerId, async (client) => {
      const before = await one<{
        revenue: string;
        net_profit: string;
        cash: string;
      }>(
        client,
        "select revenue::text,net_profit::text,cash::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      const key = randomUUID();
      const input = {
        productId: refs.miniUpsProduct,
        quantity: "3",
        totalValue: "75",
        date: "2026-07-16",
        description: "Trois Mini UPS possédés au démarrage",
        key,
      };
      const opening = await recordOpeningStock(client, input);
      const retry = await recordOpeningStock(client, input);
      expect(retry.id).toBe(opening.id);
      await client.query("savepoint expected_opening_conflict");
      await expect(
        recordOpeningStock(client, { ...input, totalValue: "76" }),
      ).rejects.toThrow(/idempotency key conflict/);
      await client.query("rollback to savepoint expected_opening_conflict");
      await client.query("release savepoint expected_opening_conflict");

      const lines = await client.query<{
        code: string;
        debit_base: string;
        credit_base: string;
        cash_account_id: string | null;
      }>(
        `select a.code,l.debit_base::text,l.credit_base::text,l.cash_account_id
         from journal_lines l
         join ledger_accounts a on a.id=l.ledger_account_id
         where l.journal_entry_id=$1 order by a.code`,
        [opening.id],
      );
      expect(lines.rows).toEqual([
        {
          code: "equity",
          debit_base: "0.0000",
          credit_base: "75.0000",
          cash_account_id: null,
        },
        {
          code: "inventory",
          debit_base: "75.0000",
          credit_base: "0.0000",
          cash_account_id: null,
        },
      ]);

      const stock = await one<{
        quantity: string;
        value_base: string;
        weighted_unit_cost_base: string;
      }>(
        client,
        `select quantity::text,value_base::text,weighted_unit_cost_base::text
         from get_inventory_snapshot($1) where product_id=$2`,
        [refs.householdId, refs.miniUpsProduct],
      );
      expect(stock).toEqual({
        quantity: "3.0000",
        value_base: "75.0000",
        weighted_unit_cost_base: "25.0000",
      });

      const after = await one<{
        revenue: string;
        net_profit: string;
        cash: string;
      }>(
        client,
        "select revenue::text,net_profit::text,cash::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      expect(after).toEqual(before);

      await client.query(
        "select reverse_journal_entry($1,'Correction ouverture')",
        [opening.id],
      );
      const reversedStock = await one<{ quantity: string }>(
        client,
        "select quantity::text from get_inventory_snapshot($1) where product_id=$2",
        [refs.householdId, refs.miniUpsProduct],
      );
      expect(reversedStock.quantity).toBe("0.0000");
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

  it("reports only active physical inventory with quantity and value", async () => {
    await asUser(ownerId, async (client) => {
      const report = await client.query<{
        label: string;
        amount: string;
        detail: string;
      }>(
        "select label,amount::text,detail from get_stock_report($1) order by label",
        [refs.householdId],
      );

      expect(report.rows.map((row) => row.label)).toEqual([
        "Android TV Box",
        "Mini UPS",
      ]);
      expect(report.rows).not.toContainEqual(
        expect.objectContaining({ label: "Offre IPTV standard" }),
      );
      expect(report.rows[0]).toEqual({
        label: "Android TV Box",
        amount: "106.6666",
        detail: "4 unités en stock",
      });
      expect(report.rows[1]).toEqual({
        label: "Mini UPS",
        amount: "0.0000",
        detail: "0 unités en stock",
      });
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
      const mpesaBeforeTransfer = await accountBalance(
        client,
        refs.householdId,
        "M-Pesa USD",
      );
      await record(client, {
        type: "transfer",
        amount: "10",
        payload: {
          source_cash_account_id: refs.cashUsd,
          destination_cash_account_id: refs.mpesaUsd,
        },
      });
      const mpesaAfterTransfer = await accountBalance(
        client,
        refs.householdId,
        "M-Pesa USD",
      );
      expect(decimalDelta(mpesaAfterTransfer, mpesaBeforeTransfer)).toBe(
        "10.0000",
      );
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
      const mpesaBeforeTransfer = await accountBalance(
        client,
        refs.householdId,
        "M-Pesa USD",
      );
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
      const mpesaAfterTransfer = await accountBalance(
        client,
        refs.householdId,
        "M-Pesa USD",
      );
      expect(decimalDelta(mpesaAfterTransfer, mpesaBeforeTransfer)).toBe(
        "39.0000",
      );
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

    await asUser(readerId, async (client) => {
      await expect(
        client.query("select * from get_inventory_snapshot($1)", [
          otherHouseholdId,
        ]),
      ).rejects.toThrow(/not allowed/);
    });
  });

  it("lets operators record operations but blocks administration and reversal", async () => {
    const entry = await asUser(operatorId, (client) =>
      record(client, {
        type: "family_contribution",
        amount: "2",
        payload: { source_cash_account_id: refs.cashUsd },
      }),
    );
    const unauthorizedUpdate = await asUser(operatorId, (client) =>
      client.query(
        "update activities set active=false where household_id=$1 and code='IPTV'",
        [refs.householdId],
      ),
    );
    expect(unauthorizedUpdate.rowCount).toBe(0);
    const unchangedActivity = await asUser(ownerId, (client) =>
      one<{ active: boolean }>(
        client,
        "select active from activities where household_id=$1 and code='IPTV'",
        [refs.householdId],
      ),
    );
    expect(unchangedActivity.active).toBe(true);
    await asUser(operatorId, (client) =>
      expect(
        client.query(
          `insert into journal_entries(
            household_id,number,type,entry_date,status,created_by
          ) values($1,$2,'manual',current_date,'draft',$3)`,
          [refs.householdId, `OPERATOR-${randomUUID()}`, operatorId],
        ),
      ).rejects.toThrow(/row-level security/),
    );
    await asUser(operatorId, (client) =>
      expect(
        client.query("select reverse_journal_entry($1,'Non autorisé')", [
          entry.id,
        ]),
      ).rejects.toThrow(/not allowed/),
    );
    await asUser(operatorId, (client) =>
      expect(
        recordOpeningStock(client, {
          productId: refs.miniUpsProduct,
          quantity: "1",
          totalValue: "25",
        }),
      ).rejects.toThrow(/not allowed/),
    );
  });

  it("records idempotent physical counts without mutating stock or accounting", async () => {
    const countKey = randomUUID();
    await asUser(ownerId, async (client) => {
      await client.query(
        "select update_stock_product_settings($1,$2,'MINI-UPS-PRO',35,2)",
        [refs.householdId, refs.miniUpsProduct],
      );
      const settings = await one<{
        sku: string;
        suggested_price: string;
        low_stock_threshold: string;
      }>(
        client,
        `select sku,suggested_price::text,low_stock_threshold::text
         from products where household_id=$1 and id=$2`,
        [refs.householdId, refs.miniUpsProduct],
      );
      expect(settings).toEqual({
        sku: "MINI-UPS-PRO",
        suggested_price: "35.0000",
        low_stock_threshold: "2.0000",
      });

      const before = await one<{
        quantity: string;
        movements: string;
        entries: string;
      }>(
        client,
        `select quantity::text,
          (select count(*)::text from stock_movements where household_id=$1) as movements,
          (select count(*)::text from journal_entries where household_id=$1) as entries
         from current_stock_balance($1,$2)`,
        [refs.householdId, refs.miniUpsProduct],
      );
      const first = await one<{ id: string }>(
        client,
        `select record_inventory_count(
          $1,$2,(select quantity+1 from current_stock_balance($1,$2)),
          current_date,$3
        ) as id`,
        [refs.householdId, refs.miniUpsProduct, countKey],
      );
      const retry = await one<{ id: string }>(
        client,
        `select record_inventory_count(
          $1,$2,(select quantity+1 from current_stock_balance($1,$2)),
          current_date,$3
        ) as id`,
        [refs.householdId, refs.miniUpsProduct, countKey],
      );
      expect(retry.id).toBe(first.id);

      const line = await one<{
        theoretical: string;
        counted: string;
        difference: string;
      }>(
        client,
        `select theoretical_quantity::text as theoretical,
          counted_quantity::text as counted,difference::text
         from inventory_count_lines where inventory_count_id=$1`,
        [first.id],
      );
      expect(decimalDelta(line.counted, line.theoretical)).toBe("1.0000");
      expect(line.difference).toBe("1.0000");

      const after = await one<{
        quantity: string;
        movements: string;
        entries: string;
      }>(
        client,
        `select quantity::text,
          (select count(*)::text from stock_movements where household_id=$1) as movements,
          (select count(*)::text from journal_entries where household_id=$1) as entries
         from current_stock_balance($1,$2)`,
        [refs.householdId, refs.miniUpsProduct],
      );
      expect(after).toEqual(before);

      await client.query("savepoint expected_count_conflict");
      await expect(
        client.query(
          `select record_inventory_count(
            $1,$2,(select quantity+2 from current_stock_balance($1,$2)),
            current_date,$3
          )`,
          [refs.householdId, refs.miniUpsProduct, countKey],
        ),
      ).rejects.toThrow(/idempotency key conflict/);
      await client.query("rollback to savepoint expected_count_conflict");
      await client.query("release savepoint expected_count_conflict");
    });

    await asUser(operatorId, async (client) => {
      await client.query(
        `select record_inventory_count(
          $1,$2,(select quantity from current_stock_balance($1,$2)),
          current_date,$3
        )`,
        [refs.householdId, refs.miniUpsProduct, randomUUID()],
      );
      await client.query("savepoint expected_operator_settings_error");
      await expect(
        client.query(
          "select update_stock_product_settings($1,$2,'FORBIDDEN',40,3)",
          [refs.householdId, refs.miniUpsProduct],
        ),
      ).rejects.toThrow(/not allowed/);
      await client.query(
        "rollback to savepoint expected_operator_settings_error",
      );
      await client.query("release savepoint expected_operator_settings_error");
    });

    await asUser(readerId, async (client) => {
      await expect(
        client.query("select record_inventory_count($1,$2,0,current_date,$3)", [
          refs.householdId,
          refs.miniUpsProduct,
          randomUUID(),
        ]),
      ).rejects.toThrow(/not allowed/);
    });
    await asUser(otherOwnerId, async (client) => {
      await expect(
        client.query("select record_inventory_count($1,$2,0,current_date,$3)", [
          refs.householdId,
          refs.miniUpsProduct,
          randomUUID(),
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

  it("reports posted account balances, remaining receivables, savings progress, and owner safety", async () => {
    await asUser(ownerId, async (client) => {
      const saleEntry = await record(client, {
        type: "credit_sale",
        amount: "100",
        activity: "IPTV",
        payload: {
          product_id: refs.iptvProduct,
          quantity: "1",
          due_date: "2026-08-01",
        },
      });
      const sale = await one<{ id: string }>(
        client,
        "select id from sales where journal_entry_id=$1",
        [saleEntry.id],
      );
      await record(client, {
        type: "payment",
        amount: "60",
        payload: { sale_id: sale.id, source_cash_account_id: refs.cashUsd },
      });
      const receivable = await one<{ amount: string }>(
        client,
        "select amount::text from get_receivables_report($1) where label=(select number from sales where id=$2)",
        [refs.householdId, sale.id],
      );
      expect(receivable.amount).toBe("40.0000");

      const savings = await record(client, {
        type: "savings_contribution",
        amount: "7",
        payload: {
          source_cash_account_id: refs.cashUsd,
          destination_cash_account_id: refs.savingsUsd,
          savings_goal_id: refs.savingsGoal,
        },
      });
      let progress = await one<{ amount: string }>(
        client,
        "select amount::text from get_savings_progress($1) where label='Urgences'",
        [refs.householdId],
      );
      expect(progress.amount).toBe("12.0000");
      await client.query("select reverse_journal_entry($1,'Correction test')", [
        savings.id,
      ]);
      progress = await one<{ amount: string }>(
        client,
        "select amount::text from get_savings_progress($1) where label='Urgences'",
        [refs.householdId],
      );
      expect(progress.amount).toBe("5.0000");

      const balancesBeforeDraft = await client.query<{
        label: string;
        amount: string;
      }>(
        "select label,amount::text from get_account_balances($1) where label in ('Caisse USD','M-Pesa USD') order by label",
        [refs.householdId],
      );
      const beforeDraftByLabel = Object.fromEntries(
        balancesBeforeDraft.rows.map((row) => [row.label, row.amount]),
      );
      const draft = await one<{ id: string }>(
        client,
        `insert into journal_entries(
          household_id,number,type,entry_date,status,created_by
        ) values($1,$2,'manual',current_date,'draft',$3) returning id`,
        [refs.householdId, `DRAFT-${randomUUID()}`, ownerId],
      );
      await client.query(
        `insert into journal_lines(
          journal_entry_id,household_id,ledger_account_id,cash_account_id,
          debit_base,credit_base,currency,source_amount,exchange_rate
        )
        select $1,$2,ca.ledger_account_id,ca.id,17,0,ca.currency,17,1
        from cash_accounts ca where ca.id=$3`,
        [draft.id, refs.householdId, refs.mpesaUsd],
      );
      await client.query(
        `insert into journal_lines(
          journal_entry_id,household_id,ledger_account_id,
          debit_base,credit_base,currency,source_amount,exchange_rate
        ) values($1,$2,(select id from ledger_accounts where household_id=$2 and code='equity'),0,17,'USD',17,1)`,
        [draft.id, refs.householdId],
      );
      const balances = await client.query<{ label: string; amount: string }>(
        "select label,amount::text from get_account_balances($1) where label in ('Caisse USD','M-Pesa USD') order by label",
        [refs.householdId],
      );
      const byLabel = Object.fromEntries(
        balances.rows.map((row) => [row.label, row.amount]),
      );
      expect(byLabel["M-Pesa USD"]).toBe(beforeDraftByLabel["M-Pesa USD"]);
      expect(byLabel["Caisse USD"]).toBe(beforeDraftByLabel["Caisse USD"]);

      await expect(
        client.query("select owner_manage_member($1,$2,'reader','active')", [
          refs.householdId,
          ownerId,
        ]),
      ).rejects.toThrow(/at least one active owner/);
    });
  });

  it("atomically reverses ledger, sales, payments, expenses, savings and stock projections", async () => {
    await asUser(ownerId, async (client) => {
      const kpiBefore = await one<{ revenue: string; cash: string }>(
        client,
        "select revenue::text,cash::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      const contribution = await record(client, {
        type: "family_contribution",
        amount: "30",
        payload: { source_cash_account_id: refs.cashUsd },
      });
      let kpis = await one<{ revenue: string; cash: string }>(
        client,
        "select revenue::text,cash::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      expect(kpis.revenue).toBe(kpiBefore.revenue);
      expect(Number(kpis.cash) - Number(kpiBefore.cash)).toBe(30);
      await client.query("select reverse_journal_entry($1,'Apport annulé')", [
        contribution.id,
      ]);
      kpis = await one<{ revenue: string; cash: string }>(
        client,
        "select revenue::text,cash::text from get_dashboard_kpis($1,null,null,null)",
        [refs.householdId],
      );
      expect(kpis.revenue).toBe(kpiBefore.revenue);
      expect(kpis.cash).toBe(kpiBefore.cash);

      const credit = await record(client, {
        type: "credit_sale",
        amount: "80",
        activity: "IPTV",
        payload: { product_id: refs.iptvProduct, quantity: "1" },
      });
      const creditSale = await one<{ id: string }>(
        client,
        "select id from sales where journal_entry_id=$1",
        [credit.id],
      );
      await client.query("select reverse_journal_entry($1,'Vente annulée')", [
        credit.id,
      ]);
      const cancelledReceivable = await one<{ status: string; count: string }>(
        client,
        `select s.status::text,
          (select count(*)::text from get_receivables_report($1) where label=s.number) as count
         from sales s where s.id=$2`,
        [refs.householdId, creditSale.id],
      );
      expect(cancelledReceivable.status).toBe("cancelled");
      expect(cancelledReceivable.count).toBe("0");

      const protectedSaleEntry = await record(client, {
        type: "credit_sale",
        amount: "100",
        activity: "IPTV",
        payload: { product_id: refs.iptvProduct, quantity: "1" },
      });
      const protectedSale = await one<{ id: string; number: string }>(
        client,
        "select id,number from sales where journal_entry_id=$1",
        [protectedSaleEntry.id],
      );
      await record(client, {
        type: "payment",
        amount: "40",
        payload: {
          sale_id: protectedSale.id,
          source_cash_account_id: refs.cashUsd,
        },
      });
      const protectedDue = await one<{ amount: string }>(
        client,
        "select amount::text from get_receivables_report($1) where label=$2",
        [refs.householdId, protectedSale.number],
      );
      expect(protectedDue.amount).toBe("60.0000");
      await client.query("savepoint expected_sale_reversal_error");
      await expect(
        client.query("select reverse_journal_entry($1,'Vente avec paiement')", [
          protectedSaleEntry.id,
        ]),
      ).rejects.toThrow(/annulez d'abord les paiements actifs/);
      await client.query("rollback to savepoint expected_sale_reversal_error");
      await client.query("release savepoint expected_sale_reversal_error");
      const protectedState = await one<{
        sale_status: string;
        payment_status: string;
        due: string;
      }>(
        client,
        `select s.status::text as sale_status, p.status::text as payment_status,
          (select amount::text from get_receivables_report($1) where label=s.number) as due
         from sales s join payments p on p.sale_id=s.id where s.id=$2`,
        [refs.householdId, protectedSale.id],
      );
      expect(protectedState).toEqual({
        sale_status: "partially_paid",
        payment_status: "posted",
        due: "60.0000",
      });

      const paidSaleEntry = await record(client, {
        type: "credit_sale",
        amount: "90",
        activity: "IPTV",
        payload: { product_id: refs.iptvProduct, quantity: "1" },
      });
      const paidSale = await one<{ id: string }>(
        client,
        "select id from sales where journal_entry_id=$1",
        [paidSaleEntry.id],
      );
      const payment = await record(client, {
        type: "payment",
        amount: "90",
        payload: { sale_id: paidSale.id, source_cash_account_id: refs.cashUsd },
      });
      await client.query("select reverse_journal_entry($1,'Paiement annulé')", [
        payment.id,
      ]);
      const restoredSale = await one<{ status: string; due: string }>(
        client,
        `select s.status::text,
          (select amount::text from get_receivables_report($1) where label=s.number) as due
         from sales s where s.id=$2`,
        [refs.householdId, paidSale.id],
      );
      expect(restoredSale.status).toBe("confirmed");
      expect(restoredSale.due).toBe("90.0000");

      const stockBefore = await one<{ quantity: string }>(
        client,
        "select quantity::text from current_stock_balance($1,$2)",
        [refs.householdId, refs.boxProduct],
      );
      const purchase = await record(client, {
        type: "stock_purchase",
        amount: "70",
        activity: "ANDROID_TV_BOX",
        payload: {
          product_id: refs.boxProduct,
          quantity: "2",
          source_cash_account_id: refs.cashUsd,
        },
      });
      await client.query("select reverse_journal_entry($1,'Achat annulé')", [
        purchase.id,
      ]);
      let stockAfter = await one<{ quantity: string; compensators: string }>(
        client,
        `select b.quantity::text,
          (select count(*)::text from stock_movements where reference_type='journal_reversal' and reference_id in (select id from journal_entries where reversal_of=$3)) as compensators
         from current_stock_balance($1,$2) b`,
        [refs.householdId, refs.boxProduct, purchase.id],
      );
      expect(stockAfter.quantity).toBe(stockBefore.quantity);
      expect(stockAfter.compensators).toBe("1");

      const physicalSale = await record(client, {
        type: "cash_sale",
        amount: "50",
        activity: "ANDROID_TV_BOX",
        payload: {
          product_id: refs.boxProduct,
          quantity: "1",
          source_cash_account_id: refs.cashUsd,
        },
      });
      const soldStock = await one<{ quantity: string }>(
        client,
        "select quantity::text from current_stock_balance($1,$2)",
        [refs.householdId, refs.boxProduct],
      );
      await client.query(
        "select reverse_journal_entry($1,'Vente physique annulée')",
        [physicalSale.id],
      );
      stockAfter = await one<{ quantity: string; compensators: string }>(
        client,
        `select b.quantity::text,
          (select count(*)::text from stock_movements where reference_type='journal_reversal' and reference_id in (select id from journal_entries where reversal_of=$3)) as compensators
         from current_stock_balance($1,$2) b`,
        [refs.householdId, refs.boxProduct, physicalSale.id],
      );
      expect(Number(stockAfter.quantity) - Number(soldStock.quantity)).toBe(1);
      expect(stockAfter.compensators).toBe("1");

      const expense = await record(client, {
        type: "family_expense",
        amount: "11",
        payload: {
          category_id: refs.familyCategory,
          source_cash_account_id: refs.cashUsd,
        },
      });
      await client.query("select reverse_journal_entry($1,'Dépense annulée')", [
        expense.id,
      ]);
      const reversedExpense = await one<{ status: string }>(
        client,
        "select status::text from expenses where journal_entry_id=$1",
        [expense.id],
      );
      expect(reversedExpense.status).toBe("reversed");
    });
  });

  it("excludes real draft lines from reports and rejects anon report RPC execution", async () => {
    await asUser(ownerId, async (client) => {
      const before = await one<{ cash: string; caisse: string }>(
        client,
        `select
          (select cash::text from get_dashboard_kpis($1,null,null,null)) as cash,
          (select amount::text from get_account_balances($1) where label='Caisse USD') as caisse`,
        [refs.householdId],
      );
      const ids = await one<{ entry: string; cash: string; equity: string }>(
        client,
        `select gen_random_uuid()::text as entry,
          (select ledger_account_id::text from cash_accounts where id=$2) as cash,
          (select id::text from ledger_accounts where household_id=$1 and code='equity') as equity`,
        [refs.householdId, refs.cashUsd],
      );
      await client.query(
        `insert into journal_entries(id,household_id,number,type,entry_date,status,created_by)
         values($1,$2,$3,'manual',current_date,'draft',$4)`,
        [ids.entry, refs.householdId, `DRAFT-${randomUUID()}`, ownerId],
      );
      await client.query(
        `insert into journal_lines(household_id,journal_entry_id,ledger_account_id,cash_account_id,debit_base,credit_base,currency,source_amount,exchange_rate)
         values($1,$2,$3,$4,999,0,'USD',999,1),($1,$2,$5,null,0,999,'USD',999,1)`,
        [refs.householdId, ids.entry, ids.cash, refs.cashUsd, ids.equity],
      );
      const after = await one<{ cash: string; caisse: string }>(
        client,
        `select
          (select cash::text from get_dashboard_kpis($1,null,null,null)) as cash,
          (select amount::text from get_account_balances($1) where label='Caisse USD') as caisse`,
        [refs.householdId],
      );
      expect(after).toEqual(before);
    });

    await asAnon(async (client) => {
      await client.query("savepoint expected_anon_dashboard_error");
      await expect(
        client.query("select * from get_dashboard_kpis($1,null,null,null)", [
          refs.householdId,
        ]),
      ).rejects.toThrow(/permission denied/);
      await client.query("rollback to savepoint expected_anon_dashboard_error");
      await client.query("release savepoint expected_anon_dashboard_error");

      await client.query("savepoint expected_anon_balances_error");
      await expect(
        client.query("select * from get_account_balances($1)", [
          refs.householdId,
        ]),
      ).rejects.toThrow(/permission denied/);
      await client.query("rollback to savepoint expected_anon_balances_error");
      await client.query("release savepoint expected_anon_balances_error");

      await client.query("savepoint expected_anon_inventory_error");
      await expect(
        client.query("select * from get_inventory_snapshot($1)", [
          refs.householdId,
        ]),
      ).rejects.toThrow(/permission denied/);
      await client.query("rollback to savepoint expected_anon_inventory_error");
      await client.query("release savepoint expected_anon_inventory_error");
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
    await asUser(ownerId, async (client) => {
      await expect(
        client.query(
          `insert into stock_movements(
            household_id,product_id,location_id,type,quantity,unit_cost_base,
            reference_type,reference_id,movement_date
          ) values(
            $1,$2,
            (select id from inventory_locations where household_id=$1 and primary_location limit 1),
            'manual',1,25,'manual',gen_random_uuid(),current_date
          )`,
          [refs.householdId, refs.miniUpsProduct],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });
});
