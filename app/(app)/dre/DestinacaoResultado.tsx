"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Bloco "Destinação do resultado" — mostra pra onde foi o lucro do período,
 * SEM reduzi-lo (reserva/investimento não é despesa). Editável por mês; no
 * modo readOnly (visão anual) só exibe o total guardado no ano.
 */
export default function DestinacaoResultado({
  lucroLiquido,
  mes,
  readOnly = false,
  reservaFixa = 0,
}: {
  lucroLiquido: number;
  mes?: string; // 'YYYY-MM' — obrigatório quando editável
  readOnly?: boolean;
  reservaFixa?: number; // usado no modo readOnly (soma do ano)
}) {
  const supabase = createClient();
  const [reserva, setReserva] = useState(reservaFixa);
  const [editando, setEditando] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(!readOnly);

  const carregar = useCallback(async () => {
    if (readOnly || !mes) return;
    setCarregando(true);
    const { data } = await supabase
      .from("destinacao_resultado")
      .select("reserva")
      .eq("mes", mes)
      .maybeSingle();
    setReserva(data ? Number(data.reserva) : 0);
    setCarregando(false);
  }, [supabase, mes, readOnly]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    if (!mes) return;
    setSalvando(true);
    const valor = Number(valorInput.replace(/\./g, "").replace(",", ".")) || 0;
    await supabase
      .from("destinacao_resultado")
      .upsert({ mes, reserva: valor, updated_at: new Date().toISOString() }, { onConflict: "mes" });
    setReserva(valor);
    setEditando(false);
    setSalvando(false);
  }

  const naoDestinado = lucroLiquido - reserva;

  return (
    <div className="bg-white rounded-md shadow-sm overflow-hidden mt-4">
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Destinação do resultado</p>
        {!readOnly && !editando && (
          <button
            onClick={() => {
              setValorInput(
                reserva
                  ? reserva.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : ""
              );
              setEditando(true);
            }}
            className="text-xs text-ledger hover:underline"
          >
            {reserva ? "Editar" : "Definir reserva"}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-2 text-sm">
        <span className="text-muted">Lucro líquido do período</span>
        <span className="font-mono tabular text-ink">{formatBRL(lucroLiquido)}</span>
      </div>

      <div className="flex items-center justify-between px-5 py-2 text-sm border-t border-line">
        <span className="text-ink">(→) Guardado como reserva/caixa</span>
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              placeholder="0,00"
              className="w-28 border border-line rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ledger"
            />
            <button
              onClick={salvar}
              disabled={salvando}
              className="text-xs px-2 py-1 rounded bg-ledger text-white hover:bg-ledger-dark disabled:opacity-50"
            >
              {salvando ? "…" : "Salvar"}
            </button>
            <button onClick={() => setEditando(false)} className="text-xs text-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        ) : (
          <span className="font-mono tabular text-ink">
            {carregando ? "…" : formatBRL(reserva)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 text-sm border-t-2 border-line bg-paper">
        <span className="font-medium text-ink">(=) Não destinado (ficou na conta)</span>
        <span className="font-mono tabular font-semibold text-ink">{formatBRL(naoDestinado)}</span>
      </div>

      <p className="px-5 py-2 text-[11px] text-muted leading-relaxed">
        Reserva/investimento não é despesa — por isso não reduz o lucro acima. Este bloco só mostra
        pra onde o lucro já apurado foi (guardado vs. deixado na conta).
      </p>
    </div>
  );
}
