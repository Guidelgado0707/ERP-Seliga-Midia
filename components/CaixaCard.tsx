"use client";

import { useState } from "react";
import CaixaForm from "./CaixaForm";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CaixaCard({
  contaCorrente,
  reserva,
  temReferencia,
}: {
  contaCorrente: { saldo: number; dataReferencia: string | null };
  reserva: { saldo: number; dataReferencia: string | null };
  temReferencia: boolean;
}) {
  const [showForm, setShowForm] = useState(!temReferencia);
  const total = contaCorrente.saldo + reserva.saldo;

  return (
    <div className="mb-6">
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="ledger-stripe bg-white rounded-md px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Conta corrente</p>
            <p className="font-mono tabular text-2xl font-semibold text-ink mt-1">
              {formatBRL(contaCorrente.saldo)}
            </p>
            {contaCorrente.dataReferencia && (
              <p className="text-xs text-muted mt-1">
                Desde{" "}
                {new Date(contaCorrente.dataReferencia + "T00:00:00").toLocaleDateString("pt-BR")}, +recebido
                −pago
              </p>
            )}
          </div>
          <div className="ledger-stripe bg-white rounded-md px-5 py-4 shadow-sm" style={{ ["--stripe-color" as any]: "#B8860B" }}>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Reserva de emergência</p>
            <p className="font-mono tabular text-2xl font-semibold text-ink mt-1">{formatBRL(reserva.saldo)}</p>
            {reserva.dataReferencia && (
              <p className="text-xs text-muted mt-1">
                Ajustada em {new Date(reserva.dataReferencia + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="bg-white rounded-md px-5 py-4 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Total em caixa</p>
              <p className="font-mono tabular text-2xl font-semibold text-ink mt-1">{formatBRL(total)}</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="text-sm font-medium px-3 py-2 rounded-md border border-line text-ink hover:bg-paper transition-colors mt-2 self-start"
            >
              Atualizar saldo
            </button>
          </div>
        </div>
      )}
      {showForm && <CaixaForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
