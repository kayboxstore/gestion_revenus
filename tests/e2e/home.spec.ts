import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
);

test("protects business routes and exposes complete French authentication", async ({
  page,
}) => {
  const portraitResponse = await page.request.get(
    "/images/famille-kayembe.jpg",
    { maxRedirects: 0 },
  );
  expect(portraitResponse.status()).toBe(200);
  expect(portraitResponse.headers()["content-type"]).toContain("image/jpeg");
  await page.goto("/operations");
  if (configured) {
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await page.goto("/stock");
  if (configured) {
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await page.goto("/activities/iptv");
  if (configured) {
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await page.goto("/login");
  const familyPortrait = page.getByAltText("Portrait du couple Kayembe");
  await expect(familyPortrait).toBeVisible();
  await expect(familyPortrait).toHaveAttribute("src", /famille-kayembe/);
  await expect
    .poll(() =>
      familyPortrait.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Créer un compte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mot de passe oublié" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/screens/login-mobile.png",
    fullPage: true,
  });
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
  await expect(page.getByText("Foyer E2E", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Opérations" }).click();
  await page.locator('select[name="operation_type"]').selectOption("cash_sale");
  await page.locator('select[name="activity_code"]').selectOption("IPTV");
  await page.locator('input[name="amount"]').fill("12");
  await page.locator('input[name="exchange_rate"]').fill("1");
  await page.locator('select[name="product_id"]').selectOption({
    label: "Offre IPTV standard",
  });
  await page.locator('input[name="quantity"]').fill("1");
  await page.locator('select[name="source_cash_account_id"]').selectOption({
    label: "Caisse USD · USD",
  });
  await page.locator('input[name="description"]').fill("Abonnement IPTV E2E");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(page.getByText("Opération validée et persistée.")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  const revenueCard = page
    .getByText("Chiffre d’affaires")
    .locator("..")
    .locator("strong");
  await expect(revenueCard).toContainText("12");
  await expect(
    page.getByText("Vente encaissée", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/screens/dashboard-mobile.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Plus" }).click();
  await page.getByRole("link", { name: /^Activités/ }).click();
  const billiard = page.locator("article").filter({ hasText: "BILLIARD" });
  await billiard.locator('select[name="active"]').selectOption("true");
  await billiard.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Activité mise à jour.")).toBeVisible();

  await page
    .getByRole("link", { name: "Gérer les clients et échéances" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clients et échéances" }),
  ).toBeVisible();
  const activationPanel = page.locator("details.iptv-action-panel");
  await activationPanel.locator("summary").click();
  const planField = activationPanel.getByLabel("Formule");
  await expect(planField).toBeVisible();
  await expect(planField).toContainText("Mensuel");
  await activationPanel.getByLabel("Nom du client").fill("Client IPTV E2E");
  await activationPanel.getByLabel("Téléphone").fill("+243810000111");
  await activationPanel.getByLabel("Identifiant IPTV").fill("client-iptv-e2e");
  await activationPanel
    .getByLabel("Compte d’encaissement")
    .selectOption({ label: "Caisse USD · USD" });
  await activationPanel
    .getByRole("button", { name: "Activer et enregistrer la vente" })
    .click();
  await expect(
    page.getByText("Client activé, vente et abonnement enregistrés ensemble."),
  ).toBeVisible();
  const iptvCard = page
    .locator("article.iptv-subscription-card")
    .filter({ hasText: "Client IPTV E2E" });
  await expect(iptvCard).toContainText("Actif");
  const renewalPanel = iptvCard.locator("details.iptv-renew-panel");
  await renewalPanel.locator("summary").click();
  await renewalPanel
    .getByLabel("Compte d’encaissement")
    .selectOption({ label: "Caisse USD · USD" });
  await renewalPanel
    .getByRole("button", { name: "Renouveler et enregistrer la vente" })
    .click();
  await expect(
    page.getByText("Abonnement renouvelé, vente et échéance enregistrées."),
  ).toBeVisible();
  await expect(
    page
      .locator("article.iptv-subscription-card")
      .filter({ hasText: "Client IPTV E2E" }),
  ).toHaveCount(1);
  await page.screenshot({
    path: "test-results/screens/iptv-mobile.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByRole("link", { name: "Plus" }).click();
  await page.locator("details.inline-creator summary").click();
  await page.getByLabel("Nom de l’objectif").fill("Urgences E2E");
  await page.getByLabel("Montant cible").fill("100");
  await page.getByRole("button", { name: "Créer l’objectif" }).click();
  await expect(page.getByText("Objectif d’épargne créé.")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByRole("link", { name: "Opérations" }).click();
  await page
    .locator('select[name="operation_type"]')
    .selectOption("savings_contribution");
  await page.locator('input[name="amount"]').fill("5");
  await page.locator('select[name="source_cash_account_id"]').selectOption({
    label: "Caisse USD · USD",
  });
  await page
    .locator('select[name="destination_cash_account_id"]')
    .selectOption({ label: "Épargne · USD" });
  await page.locator('select[name="savings_goal_id"]').selectOption({
    label: "Urgences E2E · USD",
  });
  await page.locator('input[name="description"]').fill("Épargne E2E");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(page.getByText("Opération validée et persistée.")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  const savingsCard = page
    .locator(".kpi-card")
    .filter({ has: page.getByText("Épargne", { exact: true }) })
    .locator("strong");
  await expect(savingsCard).toContainText("5");

  await page.getByRole("link", { name: "Opérations" }).click();
  const savingsEntry = page
    .locator(".operations-journal-list > li")
    .filter({ hasText: "Épargne" })
    .filter({ hasText: "Validée" })
    .first();
  await savingsEntry.locator("summary").click();
  await savingsEntry.getByLabel("Motif d’annulation").fill("Correction E2E");
  await savingsEntry
    .getByRole("button", { name: "Annuler l’écriture" })
    .click();
  await expect(
    page.getByText("Écriture annulée par une écriture inverse traçable."),
  ).toBeVisible();

  await page
    .locator('select[name="operation_type"]')
    .selectOption("opening_stock");
  await expect(
    page.getByText("Il ne touche ni la caisse, ni le revenu, ni les dépenses."),
  ).toBeVisible();
  await page.locator('input[name="amount"]').fill("50");
  await page.locator('input[name="exchange_rate"]').fill("1");
  const miniUpsOpeningValue = await page
    .locator('select[name="product_id"] option')
    .filter({ hasText: "Mini UPS" })
    .getAttribute("value");
  expect(miniUpsOpeningValue).toBeTruthy();
  await page
    .locator('select[name="product_id"]')
    .selectOption(miniUpsOpeningValue!);
  await page.locator('input[name="quantity"]').fill("2");
  await page
    .locator('input[name="description"]')
    .fill("Stock Mini UPS avant application");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(
    page.getByText(
      "Stock initial enregistré sans modifier la caisse ni le résultat.",
    ),
  ).toBeVisible();
  const stockCard = page.locator("section.stock-card");
  const miniUpsStock = stockCard.locator("li").filter({ hasText: "Mini UPS" });
  await expect(miniUpsStock.locator("strong").last()).toContainText("2");

  await page.locator('select[name="operation_type"]').selectOption("cash_sale");
  await page.locator('select[name="activity_code"]').selectOption("MINI_UPS");
  await page.locator('input[name="amount"]').fill("30");
  const miniUpsSaleValue = await page
    .locator('select[name="product_id"] option')
    .filter({ hasText: "Mini UPS" })
    .getAttribute("value");
  expect(miniUpsSaleValue).toBeTruthy();
  await page
    .locator('select[name="product_id"]')
    .selectOption(miniUpsSaleValue!);
  await page.locator('input[name="quantity"]').fill("1");
  await page.locator('select[name="source_cash_account_id"]').selectOption({
    label: "Caisse USD · USD",
  });
  await page.locator('input[name="description"]').fill("Vente Mini UPS E2E");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(page.getByText("Opération validée et persistée.")).toBeVisible();
  await expect(
    stockCard
      .locator("li")
      .filter({ hasText: "Mini UPS" })
      .locator("strong")
      .last(),
  ).toContainText("1");
  await page.screenshot({
    path: "test-results/screens/operations-mobile.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Stock", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stock" })).toBeVisible();
  await expect(
    page.getByText("Valeur comptable", { exact: true }),
  ).toBeVisible();
  const miniUpsCard = page
    .locator("article.stock-product-card")
    .filter({ hasText: "Mini UPS" });
  await expect(miniUpsCard.getByText("Stock bas")).toBeVisible();
  await expect(
    miniUpsCard.getByText("Disponible").locator("..").locator("strong"),
  ).toContainText("1");
  const countPanel = miniUpsCard
    .locator("details.stock-tool-panel")
    .filter({ hasText: "Comptage physique" });
  await countPanel.locator("summary").click();
  await countPanel.locator('input[name="counted_quantity"]').fill("1");
  await countPanel
    .getByRole("button", { name: "Enregistrer le comptage" })
    .click();
  await expect(page.getByText("Comptage physique enregistré.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inventaires physiques" }),
  ).toBeVisible();
  await expect(page.getByText("Écart 0", { exact: false })).toBeVisible();
  await expect(page.locator(".stock-history-list li").first()).toContainText(
    "Vente",
  );
  await page.screenshot({
    path: "test-results/screens/stock-mobile.png",
    fullPage: true,
  });
});

test("administre les rôles et exporte les rapports authentifiés", async ({
  page,
}) => {
  test.skip(!configured, "Supabase local credentials are required");
  const email = process.env.TEST_OWNER_EMAIL ?? "e2e-owner@example.test";
  const password = process.env.TEST_OWNER_PASSWORD ?? "Test-password-1";

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.getByRole("link", { name: "Plus" }).click();
  await expect(
    page.getByRole("heading", { name: "Membres, invitations et rôles" }),
  ).toBeVisible();
  await page.getByLabel("Email invité").fill("lecteur-e2e@example.test");
  await page.locator('select[name="role"]').last().selectOption("reader");
  await page.getByRole("button", { name: "Inviter" }).click();
  await expect(page.getByText("Invitation créée.")).toBeVisible();

  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByRole("link", { name: "Opérations" }).click();
  await page
    .locator('select[name="operation_type"]')
    .selectOption("credit_sale");
  await page.locator('select[name="activity_code"]').selectOption("IPTV");
  await page.locator('input[name="amount"]').fill("23.50");
  await page.locator('input[name="exchange_rate"]').fill("1");
  await page.locator('select[name="product_id"]').selectOption({
    label: "Offre IPTV standard",
  });
  await page.locator('input[name="quantity"]').fill("1");
  await page.locator('input[name="due_date"]').fill("2026-12-31");
  await page
    .locator('input[name="description"]')
    .fill("Vente IPTV à crédit E2E export");
  await page.getByRole("button", { name: "Valider l’opération" }).click();
  await expect(page.getByText("Opération validée et persistée.")).toBeVisible();
  const creditSaleEntry = page
    .locator("li")
    .filter({ hasText: "Vente à crédit" })
    .filter({ hasText: "Validée" })
    .filter({ hasText: /CRE-/ })
    .first();
  await expect(creditSaleEntry).toContainText(/CRE-[^\s·]+/);
  await expect(creditSaleEntry).toContainText("Vente à crédit");
  await expect(creditSaleEntry).toContainText("Validée");

  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByRole("link", { name: "Rapports" }).click();
  await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
  await expect(page.getByText("Marge par activité")).toBeVisible();
  await expect(page.getByText("Dépenses par catégorie")).toBeVisible();
  await expect(page.getByText("Créances clients")).toBeVisible();
  await page.screenshot({
    path: "test-results/screens/reports-mobile.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exporter CSV côté serveur" }).click();
  const download = await downloadPromise;
  const csv = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of csv!) chunks.push(Buffer.from(chunk));
  const content = Buffer.concat(chunks).toString("utf8");
  expect(content).toContain('"Section","Libellé","Montant","Détail"');
  expect(content).toContain('"Marge par activité"');
  expect(content).toContain('"Créances"');
  expect(content).toMatch(/"Créances","CRE-[^"]+","23\.5000","confirmed"/);
});
