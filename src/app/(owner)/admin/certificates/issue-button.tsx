"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { markCertificateIssuedAction } from "./actions";

export function IssueButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleIssue() {
    setError(null);
    startTransition(async () => {
      const res = await markCertificateIssuedAction({ id });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleIssue}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
        Отметить «Выдан»
      </button>
      {error ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="size-3.5" />
          {error}
        </span>
      ) : null}
    </div>
  );
}
