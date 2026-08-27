"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import type { C6Transaction } from "@/lib/c6bank";

// ---------- helpers ----------

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function diffDias(a: string, b: string) {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}
function fmtDate(s?: string) {
  if (!s) return "—";
  const d = s.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function txAmount(tx: C6Transaction): number {
  return parseFloat(tx.amount ?? "0") || 0;
}
function txDate(tx: C6Transaction): string {
  return tx.entry_date ?? tx.created_at?.slice(0, 10) ?? "";
}
function txDescription(tx: C6Transaction): string {
  return tx.title ?? tx.description ?? tx.transaction_type ?? "—";
}
function txRef(tx: C6Transaction): string | null {
  return tx.reference ?? tx.local_reference ?? null;
}

// ---------- tipos ----------

type ContaRow = {
  id: string;
  descricao: string;
  fornecedor?: string | null;
  cliente?: string | null;
  valor: number;
  data_vencimento: string;
};

type Candidato = { tipo: "pagar" | "receber"; conta: ContaRow };

type Sugestao = { tx: C6Transaction; candidatos: Candidato[] };

// ---------- componente ----------

export default function Conciliacao() {
  const supabase = createClient();

  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(daysAgo(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscou, setBuscou] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [semMatch, setSemMatch] = useState<C6Transaction[]>([]);
  const [jaConciliadosCount, setJaConciliadosCount] = useState(0);
  const [escolha, setEscolha] = useState<Record<string, string>>({}); // txRef -> contaId
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSugestoes([]);
    setSemMatch([]);
    setBuscou(false);

    try {
      const res = await fetch(`/api/c6bank/extrato?start=${start}&end=${end}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const transactions: C6Transaction[] = data.transactions ?? [];

      // referências já conciliadas anteriormente (não sugerir de novo)
      const [pagarRefsRes, receberRefsRes] = await Promise.all([
        supabase.from("contas_pagar").select("banco_referencia").not("banco_referencia", "is", null),
        supabase.from("contas_receber").select("banco_referencia").not("banco_referencia", "is", null),
      ]);
      const jaConciliados = new Set<string>([
        ...(pagarRefsRes.data ?? []).map((r) => r.banco_referencia as string),
        ...(receberRefsRes.data ?? []).map((r) => r.banco_referencia as string),
      ]);

      const comRef = transactions.filter((tx) => txRef(tx) !== null);
      const pendentes = comRef.filter((tx) => !jaConciliados.has(txRef(tx)!));
      setJaConciliadosCount(comRef.length - pendentes.length);

      // contas em aberto candidatas (ainda não conciliadas)
      const [pagarRes, receberRes] = await Promise.all([
        supabase
          .from("contas_pagar")
          .select("id, descricao, fornecedor, valor, data_vencimento")
          .in("status", ["pendente", "atrasado"])
          .is("banco_referencia", null),
        supabase
          .from("contas_receber")
          .select("id, descricao, cliente, valor, data_vencimento")
          .in("status", ["pendente", "atrasado"])
          .is("banco_referencia", null),
      ]);
      const contasPagar: ContaRow[] = pagarRes.data ?? [];
      const contasReceber: ContaRow[] = receberRes.data ?? [];

      const novasSugestoes: Sugestao[] = [];
      const novoSemMatch: C6Transaction[] = [];

      for (const tx of pendentes) {
        const valorTx = txAmount(tx);
        const isOut = tx.operation_type === "OUTGOING";
        const pool = isOut ? contasPagar : contasReceber;
        const brutos = pool.filter((c) => Math.abs(Number(c.valor) - valorTx) < 0.01);

        if (brutos.length === 0) {
          novoSemMatch.push(tx);
          continue;
        }

        const dataTx = txDate(tx);
        const ordenados = [...brutos].sort(
          (a, b) =>
            Math.abs(diffDias(a.data_vencimento, dataTx)) -
            Math.abs(diffDias(b.data_vencimento, dataTx))
        );

        novasSugestoes.push({
          tx,
          candidatos: ordenados.map((c) => ({ tipo: isOut ? "pagar" : "receber", conta: c })),
        });
      }

      setSugestoes(novasSugestoes);
      setSemMatch(novoSemMatch);
      setBuscou(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [start, end, supabase]);

  async function confirmar(tx: C6Transaction, candidato: Candidato) {
    const ref = txRef(tx);
    if (!ref) return;
    setConfirmando(ref);

    const tabela = candidato.tipo === "pagar" ? "contas_pagar" : "contas_receber";
    const campoData = candidato.tipo === "pagar" ? "data_pagamento" : "data_recebimento";
    const campoEm = candidato.tipo === "pagar" ? "pago_em" : "recebido_em";
    const statusValor = candidato.tipo === "pagar" ? "pago" : "recebido";
    const dataEntrada = txDate(tx) || new Date().toISOString().slice(0, 10);

    const { error: updErr } = await supabase
      .from(tabela)
      .update({
        status: statusValor,
        [campoData]: dataEntrada,
        [campoEm]: new Date().toISOString(),
        banco_referencia: ref,
      })
      .eq("id", candidato.conta.id);

    if (!updErr) {
      setSugestoes((prev) => prev.filter((s) => txRef(s.tx) !== ref));
    } else {
      setError(`Falha ao confirmar: ${updErr.message}`);
    }
    setConfirmando(null);
  }

  return (
    <div className="space-y-6">
      {/* filtro de período */}
      <div className="bg-white border border-line rounded-xl p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted font-medium">Data início</label>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
            className="border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted font-medium">Data fim</label>
          <input
            type="date"
            value={end}
            min={start}
            max={addDays(start, 30)}
            onChange={(e) => setEnd(e.target.value)}
            className="border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger"
          />
        </div>
        <button
          onClick={buscar}
          disabled={loading}
          className="px-5 py-2 rounded-md bg-ledger text-white text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Buscando…" : "Buscar lançamentos"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Erro:</strong> <code className="text-xs break-all">{error}</code>
        </div>
      )}

      {buscou && !error && (
        <>
          {/* resumo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-line rounded-xl p-4">
              <p className="text-xs text-muted uppercase tracking-wide">Sugestões de match</p>
              <p className="text-2xl font-bold text-ledger mt-1">{sugestoes.length}</p>
            </div>
            <div className="bg-white border border-line rounded-xl p-4">
              <p className="text-xs text-muted uppercase tracking-wide">Sem conta correspondente</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{semMatch.length}</p>
            </div>
            <div className="bg-white border border-line rounded-xl p-4">
              <p className="text-xs text-muted uppercase tracking-wide">Já conciliados antes</p>
              <p className="text-2xl font-bold text-muted mt-1">{jaConciliadosCount}</p>
            </div>
          </div>

          {/* sugestões de match */}
          <div>
            <h2 className="text-sm font-semibold text-ink mb-2">
              Sugestões de conciliação
            </h2>
            {sugestoes.length === 0 ? (
              <div className="bg-white border border-line rounded-xl py-10 text-center text-muted text-sm">
                Nenhuma sugestão pendente neste período.
              </div>
            ) : (
              <div className="bg-white border border-line rounded-xl divide-y divide-line overflow-hidden">
                {sugestoes.map((s) => {
                  const ref = txRef(s.tx)!;
                  const isOut = s.tx.operation_type === "OUTGOING";
                  const escolhidoId = escolha[ref] ?? s.candidatos[0].conta.id;
                  const candidatoEscolhido =
                    s.candidatos.find((c) => c.conta.id === escolhidoId) ?? s.candidatos[0];

                  return (
                    <div key={ref} className="p-4 flex flex-wrap items-center gap-4">
                      {/* lançamento do banco */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOut ? "bg-crimson" : "bg-emerald-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {txDescription(s.tx)}
                          </p>
                          <p className="text-xs text-muted">
                            {fmtDate(txDate(s.tx))} · {isOut ? "Saída" : "Entrada"} ·{" "}
                            <span className={isOut ? "text-crimson" : "text-emerald-600"}>
                              {fmtBRL(txAmount(s.tx))}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span className="text-muted text-sm shrink-0">↔</span>

                      {/* candidato(s) na contas a pagar/receber */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {s.candidatos.length > 1 ? (
                          <select
                            value={escolhidoId}
                            onChange={(e) =>
                              setEscolha((prev) => ({ ...prev, [ref]: e.target.value }))
                            }
                            className="border border-line rounded-md px-2 py-1.5 text-sm max-w-full"
                          >
                            {s.candidatos.map((c) => (
                              <option key={c.conta.id} value={c.conta.id}>
                                {c.conta.descricao} ({c.conta.fornecedor ?? c.conta.cliente ?? "—"}) ·{" "}
                                venc. {fmtDate(c.conta.data_vencimento)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-sm text-ink truncate">
                              {candidatoEscolhido.conta.descricao}
                            </p>
                            <p className="text-xs text-muted">
                              {candidatoEscolhido.conta.fornecedor ??
                                candidatoEscolhido.conta.cliente ??
                                "—"}{" "}
                              · venc. {fmtDate(candidatoEscolhido.conta.data_vencimento)}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => confirmar(s.tx, candidatoEscolhido)}
                        disabled={confirmando === ref}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {confirmando === ref ? "Confirmando…" : "✓ Confirmar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* sem match — só sinaliza */}
          {semMatch.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">
                Sem conta correspondente
              </h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl divide-y divide-amber-200 overflow-hidden">
                {semMatch.map((tx, i) => {
                  const isOut = tx.operation_type === "OUTGOING";
                  return (
                    <div
                      key={txRef(tx) ?? i}
                      className="p-3.5 flex items-center gap-3"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOut ? "bg-crimson" : "bg-emerald-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {txDescription(tx)}
                        </p>
                        <p className="text-xs text-amber-700">
                          {fmtDate(txDate(tx))} · nenhuma conta {isOut ? "a pagar" : "a receber"}{" "}
                          pendente com esse valor
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          isOut ? "text-crimson" : "text-emerald-600"
                        }`}
                      >
                        {fmtBRL(txAmount(tx))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-2">
                Cadastre manualmente em A Pagar/A Receber se fizer sentido, ou ignore se for algo
                como tarifa bancária.
              </p>
            </div>
          )}
        </>
      )}

      {!buscou && !loading && !error && (
        <div className="bg-white border border-line rounded-xl py-20 text-center text-muted text-sm">
          Selecione o período e clique em <strong>Buscar lançamentos</strong> para conciliar
          o extrato com as contas a pagar/receber.
        </div>
      )}
    </div>
  );
}
