"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-disabled={pending}
      className="premium-button operation-submit w-full disabled:cursor-wait disabled:opacity-60"
    >
      {pending && <span className="submit-spinner" aria-hidden="true" />}
      {pending ? "Validation en cours…" : "Valider l’opération"}
    </button>
  );
}
