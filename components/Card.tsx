export function StatCard({
  label,
  value,
  hint,
  tone = "ledger",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ledger" | "amber" | "crimson";
}) {
  const stripeColor =
    tone === "amber" ? "#B8860B" : tone === "crimson" ? "#B3261E" : "#0F6B5C";

  return (
    <div
      className="ledger-stripe bg-white rounded-md px-5 py-4 shadow-sm"
      style={{ ["--stripe-color" as any]: stripeColor }}
    >
      <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
      <p className="font-mono tabular text-2xl font-semibold text-ink mt-1.5">{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "bg-amber-soft text-amber",
    pago: "bg-ledger-soft text-ledger-dark",
    recebido: "bg-ledger-soft text-ledger-dark",
    atrasado: "bg-crimson-soft text-crimson",
    cancelado: "bg-line text-muted",
    pendente_categorizacao: "bg-amber-soft text-amber",
    vinculada: "bg-ledger-soft text-ledger-dark",
    ignorada: "bg-line text-muted",
    editado: "bg-ledger-soft text-ledger-dark",
    nao_editado: "bg-amber-soft text-amber",
  };
  const labels: Record<string, string> = {
    pendente: "Pendente",
    pago: "Pago",
    recebido: "Recebido",
    atrasado: "Atrasado",
    cancelado: "Cancelado",
    pendente_categorizacao: "Pendente",
    vinculada: "Vinculada",
    ignorada: "Ignorada",
    editado: "Editado",
    nao_editado: "Não editado",
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${map[status] ?? "bg-line text-muted"}`}>
      {labels[status] ?? status}
    </span>
  );
}
