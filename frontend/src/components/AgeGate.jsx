import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AGE_CONFIRMED_KEY = "white_label_age_confirmed";

function hasConfirmedAge() {
  try {
    return window.localStorage.getItem(AGE_CONFIRMED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function AgeGate({ config, loading = false }) {
  const [confirmed, setConfirmed] = useState(hasConfirmedAge);
  const [denied, setDenied] = useState(false);
  const enabled = config?.age_gate_enabled === true;
  const minAge = Number(config?.age_gate_min_age) || 18;

  const confirmAge = () => {
    try {
      window.localStorage.setItem(AGE_CONFIRMED_KEY, "true");
    } catch {
      // The current visit can continue even when storage is unavailable.
    }
    setConfirmed(true);
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-brand-cream"
        aria-label="Carregando configuração da loja"
        aria-busy="true"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
      </div>
    );
  }

  if (!enabled || confirmed) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="w-[calc(100%_-_2rem)] max-w-md rounded-lg border-stone-200 p-6 sm:p-8"
        data-testid="age-gate"
      >
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="font-serif text-2xl leading-tight text-stone-900">
            {config?.age_gate_title || `Você tem ${minAge} anos ou mais?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-sm text-sm leading-6 text-stone-600">
            {config?.age_gate_message ||
              `Confirme que você possui pelo menos ${minAge} anos para acessar esta loja.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {denied && (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
            role="alert"
            data-testid="age-gate-denied"
          >
            Acesso não permitido para menores de {minAge} anos.
          </p>
        )}

        <AlertDialogFooter className="mt-2 gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            onClick={confirmAge}
            className="h-11 w-full bg-brand text-white hover:bg-brand-dark"
            data-testid="age-gate-confirm"
          >
            Sim, tenho {minAge} anos ou mais
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDenied(true)}
            className="h-11 w-full border-stone-300"
            data-testid="age-gate-deny"
          >
            Não
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
