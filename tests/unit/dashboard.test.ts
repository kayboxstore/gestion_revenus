import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { getIptvAlertCount } from "@/lib/dashboard/iptv-alerts";

describe("dashboard implementation", () => {
  it("does not define module-level production fixture operations in app/page", async () => {
    const page = await readFile("app/page.tsx", "utf8");
    expect(page).not.toContain('saleCash("120');
    expect(page).not.toContain('familyExpense("18');
    expect(page).toContain("getDashboardData");
  });

  it("counts every IPTV alert while keeping only four preview rows", () => {
    const preview = Array.from({ length: 4 }, () => ({ total_count: "7" }));
    expect(getIptvAlertCount(preview)).toBe(7);
  });
});
