import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("operation safety migration", () => {
  it("scopes idempotency by household and keeps first/retry IDs separate", async () => {
    const sql = await readFile(
      "supabase/migrations/202607170002_operation_safety.sql",
      "utf8",
    );
    expect(sql).toContain("existing_entry_id uuid");
    expect(sql).toContain(
      "where household_id=p_household_id and idempotency_key=p_idempotency_key for update",
    );
    expect(sql).toContain("idempotency key conflict for household");
  });

  it("requires explicit domain references instead of arbitrary first records", async () => {
    const sql = await readFile(
      "supabase/migrations/202607170002_operation_safety.sql",
      "utf8",
    );
    expect(sql).toContain("product is required for sales");
    expect(sql).toContain("payment requires sale_id and cash account");
    expect(sql).toContain(
      "transfer requires distinct source and destination cash accounts",
    );
    expect(sql).not.toContain("base_amount * 0.60");
    expect(sql).not.toContain("order by name limit 1;\n select id into prod");
  });

  it("uses weighted average cost, freezes sale COGS and blocks negative stock", async () => {
    const sql = await readFile(
      "supabase/migrations/202607170002_operation_safety.sql",
      "utf8",
    );
    expect(sql).toContain("function current_stock_balance");
    expect(sql).toContain("weighted_unit_cost_base");
    expect(sql).toContain(
      "if stock_qty < qty then raise exception 'insufficient stock'",
    );
    expect(sql).toContain("insert into sale_items");
    expect(sql).toContain("insert into stock_movements");
  });

  it("traces multi-cash transfers through cash-account line references", async () => {
    const sql = await readFile(
      "supabase/migrations/202607170002_operation_safety.sql",
      "utf8",
    );
    expect(sql).toContain("add column if not exists cash_account_id");
    expect(sql).toContain("journal_lines_cash_same_household");
    expect(sql).toContain(
      "case when l.cash_account_id is not null then l.debit_base-l.credit_base",
    );
  });
});
