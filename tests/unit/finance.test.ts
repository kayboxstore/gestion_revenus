import { describe, expect, it } from "vitest";
import {
  familyExpense,
  reverse,
  saleCash,
  savingsContribution,
  summarize,
  transfer,
} from "@/lib/finance/domain";
describe("financial domain", () => {
  it("posts balanced sale with gross profit after COGS", () => {
    const e = saleCash("100", "35");
    expect(() => saleCash("100", "35")).not.toThrow();
    expect(summarize([e]).grossProfit).toBe("65.0000");
  });
  it("keeps family expenses outside net activity profit", () => {
    const s = saleCash("100", "20"),
      f = familyExpense("30");
    expect(summarize([s, f]).netProfit).toBe("80.0000");
    expect(summarize([s, f]).familyExpenses).toBe("30.0000");
  });
  it("does not count transfer or savings as revenue or expense", () => {
    const sum = summarize([transfer("50"), savingsContribution("10")]);
    expect(sum.revenue).toBe("0.0000");
    expect(sum.netProfit).toBe("0.0000");
    expect(sum.savings).toBe("10.0000");
  });
  it("reverses by inverse balanced entry", () => {
    const e = saleCash("80", "30");
    const r = reverse(e, "annulation test");
    expect(summarize([e, r]).revenue).toBe("0.0000");
  });
  it("freezes CDF conversion rate on journal lines", () => {
    const e = saleCash("100000", "40000", "CDF", "0.00035");
    expect(e.lines[0].currency).toBe("CDF");
    expect(e.lines[0].exchangeRate).toBe("0.00035");
    expect(e.lines[0].debitBase).toBe("35.0000");
  });
});
