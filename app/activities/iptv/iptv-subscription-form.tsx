"use client";

import { useMemo, useState } from "react";
import { recordIptvSubscription } from "@/app/actions/iptv";
import { AppIcon } from "@/components/app-icon";
import { formatMoney } from "@/lib/finance/money";
import type { IptvCashAccount, IptvPlan } from "@/lib/iptv/queries";

export function IptvSubscriptionForm({
  mode,
  plans,
  cashAccounts,
  baseCurrency,
  today,
  idempotencyKey,
  renewedFromId,
  customerName,
  customerIdentifier,
  currentPlanId,
}: {
  mode: "activation" | "renewal";
  plans: IptvPlan[];
  cashAccounts: IptvCashAccount[];
  baseCurrency: string;
  today: string;
  idempotencyKey: string;
  renewedFromId?: string;
  customerName?: string;
  customerIdentifier?: string;
  currentPlanId?: string;
}) {
  const initialPlan =
    plans.find((plan) => plan.id === currentPlanId) ?? plans[0];
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [paymentType, setPaymentType] = useState<"cash_sale" | "credit_sale">(
    "cash_sale",
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === planId),
    [planId, plans],
  );
  const availableAccounts = cashAccounts.filter(
    (account) => account.currency === selectedPlan?.currency,
  );
  const requiresRate = selectedPlan?.currency !== baseCurrency;

  return (
    <form action={recordIptvSubscription} className="iptv-subscription-form">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {renewedFromId && (
        <input type="hidden" name="renewed_from_id" value={renewedFromId} />
      )}

      {mode === "activation" ? (
        <div className="iptv-form-grid">
          <label className="field-label">
            Nom du client
            <input
              className="premium-field"
              name="customer_name"
              minLength={2}
              maxLength={100}
              required
              autoComplete="name"
              placeholder="Ex. Patrick Mbuyi"
            />
          </label>
          <label className="field-label">
            Téléphone
            <input
              className="premium-field"
              name="customer_phone"
              maxLength={40}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+243…"
            />
          </label>
          <label className="field-label iptv-field-wide">
            Identifiant IPTV
            <input
              className="premium-field"
              name="customer_identifier"
              minLength={2}
              maxLength={120}
              required
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Nom d’utilisateur, ligne ou code client"
            />
          </label>
        </div>
      ) : (
        <div className="iptv-renewal-customer">
          <span>
            <AppIcon name="user" />
          </span>
          <div>
            <small>Renouvellement pour</small>
            <strong>{customerName}</strong>
            <p>{customerIdentifier}</p>
          </div>
        </div>
      )}

      <div className="iptv-form-grid">
        <label className="field-label">
          Formule
          <select
            className="premium-field"
            name="plan_id"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            required
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {formatMoney(plan.price, plan.currency)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Date d’activation
          <input
            className="premium-field"
            name="activation_date"
            type="date"
            defaultValue={today}
            required
          />
        </label>
      </div>

      {selectedPlan && (
        <div className="iptv-plan-preview" aria-live="polite">
          <span>
            <AppIcon name="signal" />
          </span>
          <div>
            <strong>{selectedPlan.name}</strong>
            <small>
              {selectedPlan.durationDays} jours · débit automatique de la
              formule
            </small>
          </div>
          <b>{formatMoney(selectedPlan.price, selectedPlan.currency)}</b>
        </div>
      )}

      <fieldset className="iptv-payment-choice">
        <legend>Mode de règlement</legend>
        <label data-selected={paymentType === "cash_sale" || undefined}>
          <input
            type="radio"
            name="payment_type"
            value="cash_sale"
            checked={paymentType === "cash_sale"}
            onChange={() => setPaymentType("cash_sale")}
          />
          <span>
            <AppIcon name="wallet" />
          </span>
          <div>
            <strong>Payé maintenant</strong>
            <small>La trésorerie est encaissée</small>
          </div>
        </label>
        <label data-selected={paymentType === "credit_sale" || undefined}>
          <input
            type="radio"
            name="payment_type"
            value="credit_sale"
            checked={paymentType === "credit_sale"}
            onChange={() => setPaymentType("credit_sale")}
          />
          <span>
            <AppIcon name="calendar" />
          </span>
          <div>
            <strong>À crédit</strong>
            <small>Une créance client est créée</small>
          </div>
        </label>
      </fieldset>

      <div className="iptv-form-grid">
        {paymentType === "cash_sale" ? (
          <label className="field-label iptv-field-wide">
            Compte d’encaissement
            <select
              className="premium-field"
              name="cash_account_id"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Choisir un compte en {selectedPlan?.currency ?? "…"}
              </option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </select>
            {availableAccounts.length === 0 && (
              <small className="iptv-field-warning">
                Aucun compte actif dans la devise de cette formule.
              </small>
            )}
          </label>
        ) : (
          <label className="field-label iptv-field-wide">
            Échéance de paiement
            <input
              className="premium-field"
              name="due_date"
              type="date"
              min={today}
              defaultValue={today}
              required
            />
          </label>
        )}
        <label className="field-label iptv-field-wide">
          Taux vers la devise de base ({baseCurrency})
          <input
            className="premium-field"
            name="exchange_rate"
            inputMode="decimal"
            pattern="\d+(\.\d{1,8})?"
            defaultValue={requiresRate ? "" : "1"}
            key={`${selectedPlan?.currency}-${baseCurrency}`}
            placeholder={requiresRate ? "Ex. 0.00035" : "1"}
            required
          />
          <small>
            {requiresRate
              ? `Valeur de 1 ${selectedPlan?.currency} en ${baseCurrency}.`
              : "Même devise : le taux reste égal à 1."}
          </small>
        </label>
      </div>

      <button
        className="premium-button iptv-submit-button"
        disabled={
          !selectedPlan ||
          (paymentType === "cash_sale" && !availableAccounts.length)
        }
      >
        <AppIcon name={mode === "activation" ? "plus" : "signal"} />
        {mode === "activation"
          ? "Activer et enregistrer la vente"
          : "Renouveler et enregistrer la vente"}
      </button>
      <p className="iptv-integrity-note">
        <AppIcon name="shield" /> Vente, paiement ou créance et période IPTV
        seront validés ensemble.
      </p>
    </form>
  );
}
