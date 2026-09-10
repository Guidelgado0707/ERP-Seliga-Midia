"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import type { C6Transaction } from "@/lib/c6bank";
import { useBancoPinToken } from "./PinGate";

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
  const pinToken = useBancoPinToken();

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
  // guarda TODAS as contas em aberto pra o usuário poder escolher qualquer uma,
  // mesmo que o valor não bata exatamente (às vezes cai com desconto/taxa,
  // ou o sistema sugere errado quando 2 contas tem o mesmo valor)
  const [todasPagar, setTodasPagar] = useState<ContaRow[]>([]);
  const [todasReceber, setTodasReceber] = useState<ContaRow[]>([]);

  // categorias pra classificar lançamento avulso operacional (na seção "sem match")
  const [categoriasPagar, setCategoriasPagar] = useState<{ id: string; nome: string }[]>([]);
  const [categoriasReceber, setCategoriasReceber] = useState<{ id: string; nome: string }[]>([]);
  // qual tx da lista "sem match" tem form aberto + o rascunho dele
  const [avulsoAberto, setAvulsoAberto] = useState<string | null>(null);
  const [avulsoForm, setAvulsoForm] = useState<{ descricao: string; tipo: "reembolso" | "operacional"; categoria_id: string }>({
    descricao: "", tipo: "reembolso", categoria_id: "",
  });
  const [registrandoAvulso, setRegistrandoAvulso] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSugestoes([]);
    setSemMatch([]);
    setBuscou(false);

    try {
      const res = await fetch(`/api/c6bank/extrato?start=${start}&end=${end}`, {
        cache: "no-store",
        headers: { "x-banco-pin-token": pinToken ?? "" },
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
      setTodasPagar(contasPagar);
      setTodasReceber(contasReceber);

      // categorias — usadas quando o usuário registra um lançamento avulso operacional
      // (pra classificar direto na DRE). Reembolso não precisa.
      const [catPagarRes, catReceberRes] = await Promise.all([
        supabase.from("categorias").select("id, nome").in("tipo", ["pagar", "ambos"]).order("nome"),
        supabase.from("categorias").select("id, nome").in("tipo", ["receber", "ambos"]).order("nome"),
      ]);
      setCategoriasPagar(catPagarRes.data ?? []);
      setCategoriasReceber(catReceberRes.data ?? []);

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
  }, [start, end, supabase, pinToken]);

  // move uma tx da lista de sugestões pra "sem match" quando o usuário
  // diz que a sugestão automática não corresponde à origem real do dinheiro
  // (ex: valor bateu por coincidência com Hyundai mas quem pagou foi outro)
  function rejeitarSugestao(tx: C6Transaction) {
    const ref = txRef(tx);
    setSugestoes((prev) => prev.filter((s) => txRef(s.tx) !== ref));
    setSemMatch((prev) => [...prev, tx]);
  }

  function abrirAvulso(tx: C6Transaction) {
    const ref = txRef(tx);
    if (!ref) return;
    setAvulsoAberto(ref);
    setAvulsoForm({
      descricao: txDescription(tx) || "",
      tipo: "reembolso",
      categoria_id: "",
    });
  }

  // Cria uma conta_pagar/receber já como paga/recebida, vinculada à tx do banco
  // (banco_referencia = ref, pra não sugerir de novo). Se for reembolso, marca
  // a flag e DRE/Painel automaticamente ignoram (já filtram por reembolso=false).
  async function registrarAvulso(tx: C6Transaction) {
    const ref = txRef(tx);
    if (!ref) return;
    setRegistrandoAvulso(true);
    try {
      const isOut = tx.operation_type === "OUTGOING";
      const valor = txAmount(tx);
      const data = txDate(tx) || new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const descricao = (avulsoForm.descricao || txDescription(tx) || "Lançamento avulso").slice(0, 200);
      const categoria_id = avulsoForm.tipo === "operacional" && avulsoForm.categoria_id ? avulsoForm.categoria_id : null;

      if (isOut) {
        const { error } = await supabase.from("contas_pagar").insert({
          descricao,
          valor,
          data_vencimento: data,
          data_pagamento: data,
          pago_em: nowIso,
          status: "pago",
          origem: "seliga_midia",
          categoria_id,
          banco_referencia: ref,
          reembolso: avulsoForm.tipo === "reembolso",
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_receber").insert({
          descricao,
          cliente: "—",
          valor,
          data_vencimento: data,
          data_recebimento: data,
          recebido_em: nowIso,
          status: "recebido",
          origem: "seliga_midia",
          categoria_id,
          banco_referencia: ref,
          reembolso: avulsoForm.tipo === "reembolso",
        });
        if (error) throw error;
      }
      // tira da lista de sem match e limpa form
      setSemMatch((prev) => prev.filter((t) => txRef(t) !== ref));
      setAvulsoAberto(null);
      setAvulsoForm({ descricao: "", tipo: "reembolso", categoria_id: "" });
    } catch (e) {
      alert(`Erro ao registrar: ${(e as Error).message}`);
    } finally {
      setRegistrandoAvulso(false);
    }
  }

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

                      {/* candidato(s) na contas a pagar/receber — sempre um select com TODAS
                          as contas em aberto na direção certa, pra permitir trocar quando o
                          match automático foi errado (ex: valor bateu com Hyundai por
                          coincidência mas quem pagou foi outro cliente). */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {(() => {
                          const idsCandidatos = new Set(s.candidatos.map((c) => c.conta.id));
                          const outras = (isOut ? todasPagar : todasReceber).filter(
                            (c) => !idsCandidatos.has(c.id),
                          );
                          const contaEscolhidaEhCandidata = idsCandidatos.has(escolhidoId);
                          // contaEscolhida pode estar em `outras` também (o usuário trocou)
                          const contaEscolhida =
                            (contaEscolhidaEhCandidata
                              ? s.candidatos.find((c) => c.conta.id === escolhidoId)?.conta
                              : outras.find((c) => c.id === escolhidoId)) ??
                            candidatoEscolhido.conta;
                          const valorConta = Number(contaEscolhida.valor);
                          const valorTx = txAmount(s.tx);
                          const bate = Math.abs(valorConta - valorTx) < 0.01;
                          return (
                            <div className="min-w-0 flex-1">
                              <select
                                value={escolhidoId}
                                onChange={(e) =>
                                  setEscolha((prev) => ({ ...prev, [ref]: e.target.value }))
                                }
                                className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
                              >
                                <optgroup label="Sugestão (valor igual)">
                                  {s.candidatos.map((c) => (
                                    <option key={c.conta.id} value={c.conta.id}>
                                      {c.conta.descricao} ({c.conta.fornecedor ?? c.conta.cliente ?? "—"}) ·{" "}
                                      venc. {fmtDate(c.conta.data_vencimento)}
                                    </option>
                                  ))}
                                </optgroup>
                                {outras.length > 0 && (
                                  <optgroup label="Outras contas em aberto">
                                    {outras.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.descricao} ({c.fornecedor ?? c.cliente ?? "—"}) ·{" "}
                                        {fmtBRL(Number(c.valor))} · venc.{" "}
                                        {fmtDate(c.data_vencimento)}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                              {!bate && (
                                <p className="text-[11px] text-amber-700 mt-1">
                                  ⚠ valor da conta ({fmtBRL(valorConta)}) diferente do banco (
                                  {fmtBRL(valorTx)}). Ao confirmar, a conta é marcada como paga/recebida
                                  com o valor da conta — se precisar ajustar, edite depois na tela A Pagar/Receber.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const cId = escolhidoId;
                            const cAtual =
                              s.candidatos.find((c) => c.conta.id === cId) ??
                              (isOut
                                ? { tipo: "pagar" as const, conta: todasPagar.find((c) => c.id === cId)! }
                                : { tipo: "receber" as const, conta: todasReceber.find((c) => c.id === cId)! });
                            if (!cAtual?.conta) return;
                            confirmar(s.tx, cAtual);
                          }}
                          disabled={confirmando === ref}
                          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {confirmando === ref ? "Confirmando…" : "✓ Confirmar"}
                        </button>
                        <button
                          onClick={() => rejeitarSugestao(s.tx)}
                          disabled={confirmando === ref}
                          title="Nenhuma dessas — trata manualmente"
                          className="px-2.5 py-1.5 rounded-md border border-line text-crimson text-xs font-medium hover:bg-crimson-soft transition-colors disabled:opacity-50"
                        >
                          ✕ Não é essa
                        </button>
                      </div>
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
                  const ref = txRef(tx) ?? String(i);
                  const isOut = tx.operation_type === "OUTGOING";
                  const abertoAqui = avulsoAberto === ref;
                  const catList = isOut ? categoriasPagar : categoriasReceber;
                  return (
                    <div key={ref} className="p-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isOut ? "bg-crimson" : "bg-emerald-500"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">
                            {txDescription(tx)}
                          </p>
                          <p className="text-xs text-amber-700">
                            {fmtDate(txDate(tx))} · nenhuma conta {isOut ? "a pagar" : "a receber"}{" "}
                            pendente com esse valor
                          </p>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${isOut ? "text-crimson" : "text-emerald-600"}`}>
                          {fmtBRL(txAmount(tx))}
                        </span>
                        {!abertoAqui && (
                          <button
                            onClick={() => abrirAvulso(tx)}
                            className="px-3 py-1.5 rounded-md bg-ledger text-white text-xs font-medium hover:bg-ledger-dark transition-colors shrink-0"
                          >
                            + Registrar
                          </button>
                        )}
                      </div>
                      {abertoAqui && (
                        <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                          <div className="md:col-span-2">
                            <label className="text-[11px] text-muted block mb-1">Descrição</label>
                            <input
                              value={avulsoForm.descricao}
                              onChange={(e) => setAvulsoForm({ ...avulsoForm, descricao: e.target.value })}
                              placeholder={isOut ? "Ex: pagamento avulso Fulano" : "Ex: reembolso viagem SP - Fulano"}
                              className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted block mb-1">Tipo</label>
                            <select
                              value={avulsoForm.tipo}
                              onChange={(e) => setAvulsoForm({ ...avulsoForm, tipo: e.target.value as "reembolso" | "operacional", categoria_id: "" })}
                              className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white"
                            >
                              <option value="reembolso">Reembolso (não afeta DRE)</option>
                              <option value="operacional">Operacional (entra na DRE)</option>
                            </select>
                          </div>
                          {avulsoForm.tipo === "operacional" && (
                            <div className="md:col-span-3">
                              <label className="text-[11px] text-muted block mb-1">Categoria (opcional)</label>
                              <select
                                value={avulsoForm.categoria_id}
                                onChange={(e) => setAvulsoForm({ ...avulsoForm, categoria_id: e.target.value })}
                                className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white"
                              >
                                <option value="">— sem categoria —</option>
                                {catList.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                              </select>
                            </div>
                          )}
                          <div className="md:col-span-3 flex gap-2">
                            <button
                              onClick={() => registrarAvulso(tx)}
                              disabled={registrandoAvulso}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {registrandoAvulso ? "Registrando…" : `✓ Registrar como ${isOut ? "pago" : "recebido"}`}
                            </button>
                            <button
                              onClick={() => { setAvulsoAberto(null); }}
                              className="px-3 py-1.5 rounded-md border border-line text-muted text-xs font-medium hover:bg-white"
                            >
                              Cancelar
                            </button>
                            {avulsoForm.tipo === "reembolso" && (
                              <span className="text-[11px] text-muted self-center ml-2">
                                Marca como reembolso = não conta na DRE nem no Painel
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-2">
                Use <strong>Registrar</strong> pra lançar direto (reembolso não afeta DRE; operacional entra na DRE com a categoria escolhida).
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
