"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  recordInventoryCount,
  updateStockProductSettings,
} from "@/app/actions/stock";
import { AppIcon } from "@/components/app-icon";
import { formatMoney } from "@/lib/finance/money";
import type { StockProduct, StockWorkspaceData } from "@/lib/stock/queries";

type StockFilter = "all" | "alerts" | "out";

const statusLabels = {
  healthy: "Stock sain",
  low: "Stock bas",
  out: "Rupture",
};

const movementLabels: Record<string, string> = {
  purchase: "Approvisionnement",
  sale: "Vente",
  opening: "Stock initial",
  reversal: "Annulation",
};

function compactDecimal(value: string) {
  return new Decimal(value).toDecimalPlaces(4).toString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function StockSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="premium-button"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending && <span className="submit-spinner" aria-hidden="true" />}
      {pending ? "Enregistrement…" : label}
    </button>
  );
}

function ProductCard({
  product,
  baseCurrency,
  canManage,
  today,
}: {
  product: StockProduct;
  baseCurrency: string;
  canManage: boolean;
  today: string;
}) {
  const countKey = useMemo(() => crypto.randomUUID(), []);
  const isEmpty = product.status === "out";
  const stockAction = isEmpty ? "opening_stock" : "stock_purchase";
  const stockActionLabel = isEmpty ? "Stock initial" : "Approvisionner";
  const productQuery = new URLSearchParams({
    product: product.id,
    return_to: "stock",
  });

  return (
    <article className="stock-product-card" data-status={product.status}>
      <header className="stock-product-header">
        <div className="stock-product-identity">
          <span>
            <AppIcon name="box" />
          </span>
          <div>
            <small>{product.activityName}</small>
            <h3>{product.name}</h3>
            <p>{product.sku ?? "SKU à définir"}</p>
          </div>
        </div>
        <span className="stock-status" data-status={product.status}>
          <i aria-hidden="true" />
          {statusLabels[product.status]}
        </span>
      </header>

      <div className="stock-quantity-panel">
        <div>
          <small>Disponible</small>
          <strong className="tabular-nums">
            {compactDecimal(product.quantity)}
          </strong>
          <span>unités</span>
        </div>
        <div className="stock-value-stack">
          <p>
            <span>Valeur</span>
            <strong>{formatMoney(product.valueBase, baseCurrency)}</strong>
          </p>
          <p>
            <span>Coût moyen</span>
            <strong>
              {formatMoney(product.weightedUnitCostBase, baseCurrency)}
            </strong>
          </p>
          <p>
            <span>Seuil d’alerte</span>
            <strong>{compactDecimal(product.lowStockThreshold)}</strong>
          </p>
        </div>
      </div>

      <div className="stock-card-actions">
        <Link
          className="premium-button"
          href={`/operations?type=${stockAction}&${productQuery.toString()}`}
        >
          <AppIcon name="purchase" />
          {stockActionLabel}
        </Link>
        <Link
          className="secondary-button"
          href={`/operations?type=cash_sale&${productQuery.toString()}`}
          aria-disabled={isEmpty}
          data-disabled={isEmpty || undefined}
          tabIndex={isEmpty ? -1 : undefined}
        >
          <AppIcon name="sale" />
          Vendre
        </Link>
      </div>

      <div className="stock-card-tools">
        <details className="stock-tool-panel">
          <summary>
            <span>
              <AppIcon name="check" /> Comptage physique
            </span>
            <AppIcon name="plus" />
          </summary>
          <form action={recordInventoryCount} className="stock-tool-form">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="idempotency_key" value={countKey} />
            <p>
              Comptez les articles réellement présents. Un écart sera signalé,
              sans écriture comptable automatique.
            </p>
            <div className="stock-form-grid">
              <label className="field-label">
                Quantité comptée
                <input
                  className="premium-field"
                  name="counted_quantity"
                  inputMode="decimal"
                  required
                  defaultValue={compactDecimal(product.quantity)}
                />
              </label>
              <label className="field-label">
                Date du comptage
                <input
                  className="premium-field"
                  name="count_date"
                  type="date"
                  max={today}
                  defaultValue={today}
                />
              </label>
            </div>
            <StockSubmitButton label="Enregistrer le comptage" />
          </form>
        </details>

        {canManage && (
          <details className="stock-tool-panel">
            <summary>
              <span>
                <AppIcon name="settings" /> Réglages produit
              </span>
              <AppIcon name="plus" />
            </summary>
            <form
              action={updateStockProductSettings}
              className="stock-tool-form"
            >
              <input type="hidden" name="product_id" value={product.id} />
              <div className="stock-form-grid stock-form-grid-settings">
                <label className="field-label">
                  SKU
                  <input
                    className="premium-field"
                    name="sku"
                    defaultValue={product.sku ?? ""}
                    maxLength={40}
                    placeholder="MINI-UPS"
                  />
                </label>
                <label className="field-label">
                  Prix conseillé ({baseCurrency})
                  <input
                    className="premium-field"
                    name="suggested_price"
                    inputMode="decimal"
                    defaultValue={product.suggestedPrice ?? ""}
                    placeholder="Facultatif"
                  />
                </label>
                <label className="field-label stock-form-full">
                  Alerter à partir de
                  <input
                    className="premium-field"
                    name="low_stock_threshold"
                    inputMode="decimal"
                    required
                    defaultValue={product.lowStockThreshold}
                  />
                </label>
              </div>
              <StockSubmitButton label="Mettre à jour la fiche" />
            </form>
          </details>
        )}
      </div>
    </article>
  );
}

export function StockWorkspace({
  data,
  today,
}: {
  data: StockWorkspaceData;
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const canManage = data.role === "owner" || data.role === "manager";
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredProducts = data.products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku ?? ""} ${
      product.activityName
    }`
      .toLocaleLowerCase("fr")
      .includes(normalizedQuery);
    const matchesFilter =
      filter === "all" ||
      (filter === "alerts" && product.status !== "healthy") ||
      (filter === "out" && product.status === "out");
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="stock-workspace">
      <section className="stock-command-hero">
        <div className="stock-command-copy">
          <p>Inventaire · {data.householdName}</p>
          <h2>Votre stock, net et maîtrisé.</h2>
          <span>
            Les quantités viennent uniquement de mouvements validés. Les
            comptages physiques servent à détecter les écarts.
          </span>
          <div className="stock-command-actions">
            <Link
              href="/operations?type=stock_purchase&return_to=stock"
              className="premium-button"
            >
              <AppIcon name="purchase" /> Nouvel approvisionnement
            </Link>
            <Link
              href="/operations?type=opening_stock&return_to=stock"
              className="stock-hero-link"
            >
              Déclarer un stock initial <AppIcon name="arrow" />
            </Link>
          </div>
        </div>
        <div className="stock-command-orbit" aria-hidden="true">
          <span className="stock-orbit-ring" />
          <span className="stock-orbit-core">
            <AppIcon name="box" />
          </span>
          <small>LIVE</small>
        </div>
      </section>

      <section className="stock-kpi-grid" aria-label="Synthèse du stock">
        <article>
          <span className="stock-kpi-icon">
            <AppIcon name="box" />
          </span>
          <div>
            <small>Produits suivis</small>
            <strong>{data.totals.productCount}</strong>
            <p>Références physiques actives</p>
          </div>
        </article>
        <article>
          <span className="stock-kpi-icon">
            <AppIcon name="purchase" />
          </span>
          <div>
            <small>Unités disponibles</small>
            <strong>{compactDecimal(data.totals.unitCount)}</strong>
            <p>Somme des quantités validées</p>
          </div>
        </article>
        <article>
          <span className="stock-kpi-icon">
            <AppIcon name="wallet" />
          </span>
          <div>
            <small>Valeur comptable</small>
            <strong>
              {formatMoney(data.totals.valueBase, data.baseCurrency)}
            </strong>
            <p>Au coût moyen pondéré</p>
          </div>
        </article>
        <article data-alert={data.totals.alertCount > 0 || undefined}>
          <span className="stock-kpi-icon">
            <AppIcon name="alert" />
          </span>
          <div>
            <small>À traiter</small>
            <strong>{data.totals.alertCount}</strong>
            <p>
              {data.totals.alertCount
                ? "Seuils atteints ou ruptures"
                : "Aucune alerte active"}
            </p>
          </div>
        </article>
      </section>

      <section className="stock-catalog-section">
        <header className="stock-section-heading">
          <div>
            <p>01 — Catalogue vivant</p>
            <h2>État des produits</h2>
          </div>
          <span>{filteredProducts.length} affiché(s)</span>
        </header>
        <div className="stock-toolbar">
          <label className="stock-search">
            <AppIcon name="reports" />
            <span className="sr-only">Rechercher un produit</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Produit, SKU ou activité…"
            />
          </label>
          <div className="stock-filters" aria-label="Filtrer le stock">
            {(
              [
                ["all", "Tous"],
                ["alerts", "Alertes"],
                ["out", "Ruptures"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-active={filter === value || undefined}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {filteredProducts.length ? (
          <div className="stock-product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                baseCurrency={data.baseCurrency}
                canManage={canManage}
                today={today}
              />
            ))}
          </div>
        ) : (
          <div className="stock-no-results">
            <AppIcon name="box" />
            <strong>Aucun produit ne correspond</strong>
            <p>Modifiez la recherche ou le filtre sélectionné.</p>
          </div>
        )}
      </section>

      <section className="stock-history-grid">
        <section className="surface-card stock-history-card">
          <header className="stock-section-heading">
            <div>
              <p>02 — Traçabilité</p>
              <h2>Derniers mouvements</h2>
            </div>
            <AppIcon name="transfer" />
          </header>
          {data.movements.length ? (
            <ul className="stock-history-list">
              {data.movements.slice(0, 12).map((movement) => {
                const incoming = new Decimal(movement.quantity).gt(0);
                return (
                  <li key={movement.id}>
                    <span className="stock-history-icon" data-in={incoming}>
                      <AppIcon name={incoming ? "income" : "expense"} />
                    </span>
                    <div>
                      <strong>{movement.productName}</strong>
                      <small>
                        {movementLabels[movement.type] ?? movement.type} ·{" "}
                        {formatDate(movement.movementDate)}
                      </small>
                    </div>
                    <b className="tabular-nums" data-in={incoming}>
                      {incoming ? "+" : ""}
                      {compactDecimal(movement.quantity)}
                    </b>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="stock-compact-empty">
              <AppIcon name="transfer" />
              <p>Les achats et ventes apparaîtront ici.</p>
            </div>
          )}
        </section>

        <section className="surface-card stock-history-card">
          <header className="stock-section-heading">
            <div>
              <p>03 — Contrôle</p>
              <h2>Inventaires physiques</h2>
            </div>
            <AppIcon name="check" />
          </header>
          {data.counts.length ? (
            <ul className="stock-count-list">
              {data.counts.map((count) => {
                const sign = new Decimal(count.difference).cmp(0);
                return (
                  <li key={count.id}>
                    <div>
                      <strong>{count.productName}</strong>
                      <small>{formatDate(count.countDate)}</small>
                    </div>
                    <p>
                      <span>
                        Théorique {compactDecimal(count.theoreticalQuantity)}
                      </span>
                      <span>
                        Compté {compactDecimal(count.countedQuantity)}
                      </span>
                    </p>
                    <b
                      data-sign={
                        sign === 0 ? "zero" : sign > 0 ? "plus" : "minus"
                      }
                    >
                      Écart {sign > 0 ? "+" : ""}
                      {compactDecimal(count.difference)}
                    </b>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="stock-compact-empty">
              <AppIcon name="check" />
              <p>Aucun comptage physique enregistré.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
