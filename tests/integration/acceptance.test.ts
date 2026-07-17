import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  defaultActivities,
  familyExpense,
  saleCash,
  savingsContribution,
  summarize,
  transfer,
} from "@/lib/finance/domain";

describe("MVP acceptance scenarios", () => {
  it("covers financial acceptance calculations without mixing cash flows and income", () => {
    const entries = [
      saleCash("12", "0"),
      saleCash("55", "30"),
      familyExpense("8"),
      transfer("20"),
      savingsContribution("5"),
      saleCash("100000", "60000", "CDF", "0.00035"),
    ];
    const s = summarize(entries);
    expect(defaultActivities.find((a) => a.code === "BILLIARD")?.active).toBe(
      false,
    );
    expect(Number(s.revenue)).toBeGreaterThan(100);
    expect(s.familyExpenses).toBe("8.0000");
    expect(s.savings).toBe("5.0000");
    expect(s.grossProfit).toBe("51.0000");
  });

  it("defines complete Supabase schema, bootstrap RPC, immutable posted entries and RLS", async () => {
    const sql = await readFile(
      "supabase/migrations/202607170001_initial_schema.sql",
      "utf8",
    );
    for (const table of [
      "profiles",
      "households",
      "household_members",
      "activities",
      "categories",
      "contacts",
      "products",
      "iptv_plans",
      "exchange_rates",
      "ledger_accounts",
      "cash_accounts",
      "journal_entries",
      "journal_lines",
      "sales",
      "sale_items",
      "payments",
      "iptv_subscriptions",
      "billiard_sessions",
      "expenses",
      "purchases",
      "purchase_items",
      "inventory_locations",
      "stock_movements",
      "savings_goals",
      "savings_contributions",
      "budgets",
      "budget_lines",
      "attachments",
      "audit_logs",
    ]) {
      expect(sql).toContain(`create table ${table}`);
    }
    expect(sql).toContain("create function bootstrap_household");
    expect(sql).toContain("create function post_journal_entry");
    expect(sql).toContain("create function reverse_journal_entry");
    expect(sql).toContain("prevent_posted_line_changes");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("security definer set search_path=public");
    expect(sql).toContain("grant execute on function bootstrap_household");
  });
});
