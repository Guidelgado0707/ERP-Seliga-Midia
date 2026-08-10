function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Linha de uma DRE. Passe valores negativos pra deduções (ex: -impostos) —
// o formatador já cuida do sinal.
export function DreLinha({
  label,
  value,
  variant = "normal",
  indent = false,
}: {
  label: string;
  value: number;
  variant?: "normal" | "subtotal" | "total";
  indent?: boolean;
}) {
  const isTotal = variant === "total";
  const isSubtotal = variant === "subtotal";
  const totalColor = value >= 0 ? "text-ledger-dark" : "text-crimson";

  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 ${isTotal ? "py-3 bg-paper" : "py-2"} ${
        indent ? "pl-9" : ""
      } ${isTotal ? "border-t-2 border-line" : isSubtotal ? "border-t border-line" : ""}`}
    >
      <span
        className={`text-sm ${isTotal || isSubtotal ? "font-semibold text-ink" : indent ? "text-muted" : "text-ink"}`}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular text-sm ${isTotal ? "text-base font-bold " + totalColor : "text-ink"}`}
      >
        {formatBRL(value)}
      </span>
    </div>
  );
}
