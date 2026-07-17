import { describe, expect, it } from "vitest";
import {
  defaultActivities,
  familyExpense,
  saleCash,
  savingsContribution,
  summarize,
  transfer,
} from "@/lib/finance/domain";
describe("MVP acceptance scenarios", () => {
  it("covers IPTV, product margin, family expense, transfer, savings, CDF and billiard inactive", () => {
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
  it("documents RLS migration policies for household isolation", async () => {
    const sql = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "supabase/migrations/202607170001_initial_schema.sql",
        "utf8",
      ),
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("is_household_member");
    expect(sql).toContain("posted journal entry must be balanced");
  });
});
