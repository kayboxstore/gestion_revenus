import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("dashboard implementation", () => {
  it("does not define module-level production fixture operations in app/page", async () => {
    const page = await readFile("app/page.tsx", "utf8");
    expect(page).not.toContain('saleCash("120');
    expect(page).not.toContain('familyExpense("18');
    expect(page).toContain("getDashboardData");
  });
});
