import { expect, test } from "@playwright/test";

test("mobile dashboard is not backed by hard-coded fixture balances", async ({
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
  await expect(page.getByText("Configurez Supabase")).toBeVisible();
  await expect(page.getByText("Foyer Kay")).toHaveCount(0);
  await expect(page.getByText("150000")).toHaveCount(0);
});

test("auth and onboarding screens expose real French forms", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Créer le foyer" }),
  ).toBeVisible();
  await expect(page.getByText("crée atomiquement le foyer")).toBeVisible();
});
