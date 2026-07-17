import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
);

test("protects business routes and exposes complete French authentication", async ({
  page,
}) => {
  await page.goto("/operations");
  if (configured) {
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Créer un compte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mot de passe oublié" }),
  ).toBeVisible();
});

test("onboards an authenticated owner and persists an IPTV cash sale", async ({
  page,
}) => {
  test.skip(!configured, "Supabase local credentials are required");
  const email = process.env.TEST_OWNER_EMAIL ?? "e2e-owner@example.test";
  const password = process.env.TEST_OWNER_PASSWORD ?? "Test-password-1";

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Créer le premier foyer" }).click();
  await page.getByLabel("Votre nom").fill("Propriétaire E2E");
  await page.getByLabel("Nom du foyer").fill("Foyer E2E");
  await page.getByRole("button", { name: "Initialiser" }).click();
  await expect(page.getByText("Foyer E2E", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Opérations" }).click();
  await page.getByLabel("Type d’opération").selectOption("cash_sale");
  await page.getByLabel("Activité", { exact: true }).selectOption("IPTV");
  await page.getByLabel("Montant source").fill("12");
  await page.getByLabel("Taux vers USD").fill("1");
  await page.getByLabel("Produit / offre IPTV").selectOption({
    label: "Offre IPTV standard",
  });
  await page.getByLabel("Quantité").fill("1");
  await page.getByLabel("Compte source / encaissement").selectOption({
    label: "Caisse USD · USD",
  });
  await page.getByLabel("Description").fill("Abonnement IPTV E2E");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(page.getByText("Opération validée et persistée.")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  const revenueCard = page
    .getByText("Chiffre d’affaires")
    .locator("..")
    .locator("strong");
  await expect(revenueCard).toContainText("12");
  await expect(page.getByText("cash_sale", { exact: false })).toBeVisible();
});
