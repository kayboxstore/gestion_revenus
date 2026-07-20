"use client";

import { useMemo, useState } from "react";
import { createQuickOperation } from "@/app/actions/operations";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import type { DashboardData } from "@/lib/dashboard/queries";
import { SubmitButton } from "./submit-button";

export const types = [
  ["cash_sale", "Vente encaissée"],
  ["credit_sale", "Vente à crédit"],
  ["payment", "Encaissement créance"],
  ["opening_stock", "Stock initial"],
  ["stock_purchase", "Achat de stock"],
  ["operating_expense", "Dépense activité"],
  ["family_expense", "Dépense familiale"],
  ["transfer", "Transfert caisse → M-Pesa"],
  ["family_contribution", "Apport familial"],
  ["family_withdrawal", "Retrait familial"],
  ["savings_contribution", "Contribution épargne"],
] as const;

export type OperationType = (typeof types)[number][0];

const typeMeta: Record<
  OperationType,
  { icon: AppIconName; eyebrow: string; help: string }
> = {
  cash_sale: {
    icon: "sale",
    eyebrow: "Vente",
    help: "Encaissez une vente et mettez à jour le résultat immédiatement.",
  },
  credit_sale: {
    icon: "calendar",
    eyebrow: "Créance",
    help: "Enregistrez le revenu maintenant et suivez le paiement à venir.",
  },
  payment: {
    icon: "income",
    eyebrow: "Paiement",
    help: "Associez un encaissement à une vente à crédit existante.",
  },
  opening_stock: {
    icon: "box",
    eyebrow: "Démarrage",
    help: "Déclarez les articles possédés avant l’utilisation de l’application.",
  },
  stock_purchase: {
    icon: "purchase",
    eyebrow: "Approvisionnement",
    help: "Transformez la trésorerie en stock sans créer une fausse dépense.",
  },
  operating_expense: {
    icon: "expense",
    eyebrow: "Activité",
    help: "Imputez une charge à l’exploitation et au bon compte de paiement.",
  },
  family_expense: {
    icon: "family",
    eyebrow: "Foyer",
    help: "Suivez les sorties familiales séparément du résultat des activités.",
  },
  transfer: {
    icon: "transfer",
    eyebrow: "Trésorerie",
    help: "Déplacez l’argent entre deux comptes sans créer revenu ni dépense.",
  },
  family_contribution: {
    icon: "income",
    eyebrow: "Capital familial",
    help: "Ajoutez un apport du foyer sans le compter comme chiffre d’affaires.",
  },
  family_withdrawal: {
    icon: "expense",
    eyebrow: "Capital familial",
    help: "Tracez un retrait personnel sans le confondre avec une charge.",
  },
  savings_contribution: {
    icon: "savings",
    eyebrow: "Objectif",
    help: "Affectez de la trésorerie à l’épargne sans créer de dépense.",
  },
};

export function isOperationType(value?: string): value is OperationType {
  return types.some(([candidate]) => candidate === value);
}

export function QuickOperationForm({
  data,
  initialType,
}: {
  data: DashboardData;
  initialType?: string;
}) {
  const [type, setType] = useState<OperationType>(
    isOperationType(initialType) ? initialType : "cash_sale",
  );
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("USD");
  const [quantity, setQuantity] = useState("");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const canManage = data.role === "owner" || data.role === "manager";
  const openingStock = type === "opening_stock";
  const visibleTypes = canManage
    ? types
    : types.filter(([value]) => value !== "opening_stock");
  const product = [
    "cash_sale",
    "credit_sale",
    "opening_stock",
    "stock_purchase",
  ].includes(type);
  const selectableProducts = openingStock
    ? data.products.filter((item) => item.type === "physical")
    : data.products;
  const payment = type === "payment";
  const expense = ["operating_expense", "family_expense"].includes(type);
  const transfer = ["transfer", "savings_contribution"].includes(type);
  const saving = type === "savings_contribution";
  const activity = [
    "cash_sale",
    "credit_sale",
    "stock_purchase",
    "operating_expense",
  ].includes(type);
  const sourceAccount = !["credit_sale", "opening_stock"].includes(type);
  const meta = typeMeta[type];

  return (
    <form
      id="operation-form"
      action={createQuickOperation}
      className="operation-composer surface-card"
    >
      <header className="operation-composer-header">
        <span className="operation-composer-icon">
          <AppIcon name={meta.icon} className="h-7 w-7" />
        </span>
        <div>
          <p>{meta.eyebrow}</p>
          <h2>Nouvelle opération</h2>
        </div>
      </header>

      <div className="operation-type-panel">
        <label className="field-label">
          Que voulez-vous enregistrer ?
          <select
            name="operation_type"
            required
            value={type}
            onChange={(event) => setType(event.target.value as OperationType)}
            className="premium-field operation-type-select"
            aria-describedby="operation-help"
          >
            {visibleTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p id="operation-help">
          <AppIcon name="check" className="h-4 w-4 shrink-0" />
          {openingStock
            ? "Il ne touche ni la caisse, ni le revenu, ni les dépenses."
            : meta.help}
        </p>
      </div>

      <section className="operation-form-section">
        <div className="operation-section-heading">
          <span>1</span>
          <div>
            <h3>Montant et date</h3>
            <p>Les informations financières de l’opération.</p>
          </div>
        </div>
        <div className="operation-amount-row">
          <label className="field-label operation-amount-field">
            {openingStock ? "Valeur totale du stock" : "Montant source"}
            <input
              name="amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="premium-field"
            />
          </label>
          <label className="field-label operation-currency-field">
            Devise
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="premium-field"
            >
              <option>USD</option>
              <option>CDF</option>
            </select>
          </label>
        </div>
        <div className="operation-two-columns">
          <label className="field-label">
            Taux vers USD
            <input
              name="exchange_rate"
              inputMode="decimal"
              required
              defaultValue="1"
              className="premium-field"
            />
          </label>
          <label className="field-label">
            Date d’opération
            <input
              name="operation_date"
              type="date"
              className="premium-field"
            />
          </label>
        </div>
      </section>

      <section className="operation-form-section">
        <div className="operation-section-heading">
          <span>2</span>
          <div>
            <h3>Affectation</h3>
            <p>Précisez l’activité, le produit et les comptes concernés.</p>
          </div>
        </div>
        <div className="operation-fields-stack">
          {activity && (
            <label className="field-label">
              Activité
              <select name="activity_code" className="premium-field">
                <option value="">Aucune / foyer</option>
                {data.activities.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {product && (
            <fieldset className="operation-fieldset">
              <legend>
                {openingStock
                  ? "Articles déjà disponibles"
                  : "Produit ou service vendu/acheté"}
              </legend>
              <label className="field-label">
                {openingStock ? "Produit physique" : "Produit / offre IPTV"}
                <select name="product_id" required className="premium-field">
                  <option value="">Choisir explicitement un produit</option>
                  {selectableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.type === "physical"
                        ? ` · stock ${product.stock_quantity ?? "0.0000"}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                {openingStock ? "Quantité déjà en stock" : "Quantité"}
                <input
                  name="quantity"
                  inputMode="decimal"
                  required
                  placeholder="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="premium-field"
                />
              </label>
              {type === "credit_sale" && (
                <label className="field-label">
                  Échéance crédit
                  <input
                    name="due_date"
                    type="date"
                    required
                    className="premium-field"
                  />
                </label>
              )}
            </fieldset>
          )}
          {payment && (
            <label className="field-label">
              Vente à régler
              <select name="sale_id" required className="premium-field">
                <option value="">Choisir une vente ouverte</option>
                {data.openSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.number} · {sale.total_source} · {sale.status}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sourceAccount && (
            <label className="field-label">
              Compte source / encaissement
              <select
                name="source_cash_account_id"
                required
                className="premium-field"
              >
                <option value="">Choisir le compte source</option>
                {data.cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </label>
          )}
          {transfer && (
            <fieldset className="operation-fieldset">
              <legend>Destination et change</legend>
              <label className="field-label">
                Compte destination
                <select
                  name="destination_cash_account_id"
                  required
                  className="premium-field"
                >
                  <option value="">Choisir le compte destination</option>
                  {data.cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </option>
                  ))}
                </select>
              </label>
              <div className="operation-two-columns">
                <label className="field-label">
                  Montant reçu
                  <input
                    name="destination_amount"
                    inputMode="decimal"
                    placeholder="Même montant"
                    className="premium-field"
                  />
                </label>
                <label className="field-label">
                  Devise reçue
                  <select name="destination_currency" className="premium-field">
                    <option value="">Même devise</option>
                    <option>USD</option>
                    <option>CDF</option>
                  </select>
                </label>
              </div>
              <label className="field-label">
                Taux destination vers USD
                <input
                  name="destination_exchange_rate"
                  inputMode="decimal"
                  placeholder="Même taux"
                  className="premium-field"
                />
              </label>
            </fieldset>
          )}
          {expense && (
            <label className="field-label">
              Catégorie de dépense
              <select name="category_id" required className="premium-field">
                <option value="">Choisir une catégorie</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} · {category.type}
                  </option>
                ))}
              </select>
            </label>
          )}
          {saving && (
            <label className="field-label">
              Objectif d’épargne
              <select name="savings_goal_id" required className="premium-field">
                <option value="">Choisir un objectif</option>
                {data.savingsGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name} · {goal.currency}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(type === "transfer" || type === "stock_purchase") && (
            <label className="field-label">
              Frais de transfert / achat
              <input
                name="fees_source"
                inputMode="decimal"
                placeholder="0.00"
                className="premium-field"
              />
            </label>
          )}
        </div>
      </section>

      <section className="operation-form-section">
        <div className="operation-section-heading">
          <span>3</span>
          <div>
            <h3>Vérification</h3>
            <p>Ajoutez un libellé clair avant de valider.</p>
          </div>
        </div>
        <label className="field-label">
          Description
          <input
            name="description"
            required
            minLength={3}
            defaultValue="Opération rapide"
            className="premium-field"
          />
        </label>
        <div className="operation-preview" aria-live="polite">
          <span className="operation-preview-icon">
            <AppIcon name={meta.icon} />
          </span>
          <div>
            <small>Aperçu avant validation</small>
            <strong>{types.find(([value]) => value === type)?.[1]}</strong>
            <p>
              {amount || "0"} {currency}
              {product && quantity ? ` · quantité ${quantity}` : ""}
            </p>
          </div>
          <span className="operation-preview-check">
            <AppIcon name="shield" />
          </span>
        </div>
      </section>
      <input name="idempotency_key" type="hidden" value={idempotencyKey} />
      <SubmitButton />
    </form>
  );
}
