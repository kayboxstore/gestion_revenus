"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-disabled={pending}
      className="rounded-xl bg-night px-4 py-3 font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Validation en cours…" : "Valider l’opération"}
    </button>
  );
}
