import { ArrowDown, ArrowUp } from "lucide-react";

export default function OrderControls({ index, total, onMoveUp, onMoveDown, label }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={`Subir ${label}`}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === total - 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={`Descer ${label}`}
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}
