import { expect, test } from "@playwright/test";
test("mobile dashboard shows finance KPIs and five item navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tableau de bord" }),
  ).toBeVisible();
  await expect(page.getByText("Chiffre d’affaires")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link"),
  ).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Vente" })).toBeVisible();
});
