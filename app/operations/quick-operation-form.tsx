"use client";

import { useMemo, useState } from "react";
import { createQuickOperation } from "@/app/actions/operations";
import type { DashboardData } from "@/lib/dashboard/queries";
import { SubmitButton } from "./submit-button";

const types = [
  ["cash_sale", "Vente encaissée"],
  ["credit_sale", "Vente à crédit"],
  ["payment", "Encaissement créance"],
  ["stock_purchase", "Achat de stock"],
  ["operating_expense", "Dépense activité"],
  ["family_expense", "Dépense familiale"],
  ["transfer", "Transfert caisse → M-Pesa"],
  ["family_contribution", "Apport familial"],
  ["family_withdrawal", "Retrait familial"],
  ["savings_contribution", "Contribution épargne"],
] as const;

type OperationType = (typeof types)[number][0];

export function QuickOperationForm({ data }: { data: DashboardData }) {
  const [type, setType] = useState<OperationType>("cash_sale");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const product = ["cash_sale", "credit_sale", "stock_purchase"].includes(type);
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
  const sourceAccount = type !== "credit_sale";

  return (
    <form
      action={createQuickOperation}
      className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm"
    >
      <label className="block text-sm font-medium">
        Type d’opération
        <select
          name="operation_type"
          required
          value={type}
          onChange={(event) => setType(event.target.value as OperationType)}
          className="mt-1 w-full rounded-xl border p-3"
          aria-describedby="operation-help"
        >
          {types.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p id="operation-help" className="text-sm text-slate-600">
        Les champs affichés changent selon le type choisi et la même règle est
        validée côté serveur.
      </p>
      {activity && (
        <label className="block text-sm font-medium">
          Activité
          <select
            name="activity_code"
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">Aucune / foyer</option>
            {data.activities.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Montant source
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue="10.00"
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Devise
          <select name="currency" className="mt-1 w-full rounded-xl border p-3">
            <option>USD</option>
            <option>CDF</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Taux vers USD
        <input
          name="exchange_rate"
          inputMode="decimal"
          required
          defaultValue="1"
          className="mt-1 w-full rounded-xl border p-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Date d’opération
        <input
          name="operation_date"
          type="date"
          className="mt-1 w-full rounded-xl border p-3"
        />
      </label>
      {product && (
        <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Produit ou service vendu/acheté
          </legend>
          <label className="block text-sm font-medium">
            Produit / offre IPTV
            <select
              name="product_id"
              required
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Choisir explicitement un produit</option>
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Quantité
            <input
              name="quantity"
              inputMode="decimal"
              required
              placeholder="1"
              className="mt-1 w-full rounded-xl border p-3"
            />
          </label>
          {type === "credit_sale" && (
            <label className="block text-sm font-medium">
              Échéance crédit
              <input
                name="due_date"
                type="date"
                required
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
          )}
        </fieldset>
      )}
      {payment && (
        <label className="block text-sm font-medium">
          Vente à régler
          <select
            name="sale_id"
            required
            className="mt-1 w-full rounded-xl border p-3"
          >
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
        <label className="block text-sm font-medium">
          Compte source / encaissement
          <select
            name="source_cash_account_id"
            required
            className="mt-1 w-full rounded-xl border p-3"
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
        <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Destination et change
          </legend>
          <label className="block text-sm font-medium">
            Compte destination
            <select
              name="destination_cash_account_id"
              required
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Choisir le compte destination</option>
              {data.cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Montant reçu
              <input
                name="destination_amount"
                inputMode="decimal"
                placeholder="Même montant"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Devise reçue
              <select
                name="destination_currency"
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="">Même devise</option>
                <option>USD</option>
                <option>CDF</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Taux destination vers USD
            <input
              name="destination_exchange_rate"
              inputMode="decimal"
              placeholder="Même taux"
              className="mt-1 w-full rounded-xl border p-3"
            />
          </label>
        </fieldset>
      )}
      {expense && (
        <label className="block text-sm font-medium">
          Catégorie de dépense
          <select
            name="category_id"
            required
            className="mt-1 w-full rounded-xl border p-3"
          >
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
        <label className="block text-sm font-medium">
          Objectif d’épargne
          <select
            name="savings_goal_id"
            required
            className="mt-1 w-full rounded-xl border p-3"
          >
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
        <label className="block text-sm font-medium">
          Frais de transfert / achat
          <input
            name="fees_source"
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
      )}
      <label className="block text-sm font-medium">
        Description
        <input
          name="description"
          required
          minLength={3}
          defaultValue="Opération rapide"
          className="mt-1 w-full rounded-xl border p-3"
        />
      </label>
      <input name="idempotency_key" type="hidden" value={idempotencyKey} />
      <SubmitButton />
    </form>
  );
}
