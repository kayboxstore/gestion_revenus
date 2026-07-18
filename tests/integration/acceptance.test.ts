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
});
