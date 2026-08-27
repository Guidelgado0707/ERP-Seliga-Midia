"use client";

import { useState, useCallback } from "react";
import type { C6Transaction } from "@/lib/c6bank";
import Conciliacao from "./Conciliacao";

// ---------- helpers ----------

function today() {
  return new Date().toISOString().slice(0, 10);
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

/** Valor absoluto do lançamento (amount é string no C6, ex: "1500.00") */
function txAmount(tx: C6Transaction): number {
  return parseFloat(tx.amount ?? "0") || 0;
}

/** INCOMING = entrada (positivo), OUTGOING = saída (negativo) */
function txSignedAmount(tx: C6Transaction): number {
  const v = txAmount(tx);
  return tx.operation_type === "OUTGOING" ? -v : v;
}

function txDate(tx: C6Transaction): string {
  return tx.entry_date ?? tx.created_at?.slice(0, 10) ?? "";
}

function txDescription(tx: C6Transaction): string {
  return tx.title ?? tx.description ?? tx.transaction_type ?? "—";
}

// ---------- componente ----------

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

export default function BancoPage() {
  const [tab, setTab] = useState<"extrato" | "conciliacao">("extrato");

  // Limite confirmado por teste real: o gateway C6 aceita no máximo 30 dias
  // corridos entre start_date e end_date (acima disso, HTTP 500 RF-InvalidRequest).
  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(daysAgo(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<C6Transaction[] | null>(null);
  const [rawDebug, setRawDebug] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [authTest, setAuthTest] = useState<{ ok: boolean; msg: string; elapsed: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const testAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthTest(null);
    setRawDebug(null);
    try {
      const res = await fetch("/api/c6bank/test-auth", { cache: "no-store" });
      const data = await res.json();
      // mostra a resposta bruta do auth no painel de debug
      setRawDebug(data);
      setShowRaw(true);
      const raw = data.rawResponse as Record<string, unknown> | null;
      const tokenKey = raw
        ? Object.keys(raw).find((k) => k.toLowerCase().includes("token"))
        : null;
      const tokenVal = tokenKey && raw ? String(raw[tokenKey]) : null;
      setAuthTest({
        ok: data.ok,
        msg: data.ok
          ? `Auth OK (HTTP ${data.httpStatus}, campo token: "${tokenKey ?? "?"}", ${data.elapsedMs}ms)`
          : `Erro HTTP ${data.httpStatus}: ${data.error ?? JSON.stringify(data.rawResponse)}`,
        elapsed: data.elapsedMs ?? 0,
      });
      // sobrescreve o tokenPrefix para mostrar o campo certo em logs futuros
      if (tokenVal) console.log("C6 token field:", tokenKey, "| prefix:", tokenVal.slice(0, 30));
    } catch (e) {
      setAuthTest({ ok: false, msg: String(e), elapsed: 0 });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTransactions(null);
    setRawDebug(null);

    try {
      const res = await fetch(
        `/api/c6bank/extrato?start=${start}&end=${end}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      // Sempre guarda a resposta bruta, mesmo em caso de erro
      if (data.raw !== undefined) setRawDebug(data.raw);
      if (data.debug !== undefined) setRawDebug(data.debug);
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTransactions(data.transactions ?? []);
      setRawDebug(data.raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const creditos = transactions
    ? transactions.filter((t) => txSignedAmount(t) > 0).reduce((s, t) => s + txAmount(t), 0)
    : 0;
  const debitos = transactions
    ? transactions.filter((t) => txSignedAmount(t) < 0).reduce((s, t) => s + txAmount(t), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Banco C6</h1>
          <p className="text-sm text-muted mt-0.5">
            Conta PJ · Sandbox{" "}
            <span className="text-amber-600 font-medium">(ambiente de testes)</span>
          </p>
        </div>
      </div>

      {/* abas */}
      <div className="flex gap-1 border-b border-line">
        <button
          onClick={() => setTab("extrato")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "extrato"
              ? "border-ledger text-ledger"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Extrato
        </button>
        <button
          onClick={() => setTab("conciliacao")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "conciliacao"
              ? "border-ledger text-ledger"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Conciliação
        </button>
      </div>

      {tab === "conciliacao" ? (
        <Conciliacao />
      ) : (
        <>
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
          onClick={load}
          disabled={loading}
          className="px-5 py-2 rounded-md bg-ledger text-white text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Carregando…" : "Consultar extrato"}
        </button>
        {(transactions !== null || rawDebug !== null || error) && (
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="px-3 py-2 rounded-md border border-line text-xs text-muted hover:text-ink transition-colors"
          >
            {showRaw ? "Ocultar" : "Ver"} resposta bruta
          </button>
        )}
      </div>

      {/* diagnóstico de autenticação */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={testAuth}
          disabled={authLoading}
          className="px-4 py-2 rounded-md border border-line text-sm text-muted hover:text-ink hover:border-ink transition-colors disabled:opacity-50"
        >
          {authLoading ? "Testando…" : "🔑 Testar autenticação"}
        </button>
        {authTest && (
          <span
            className={`text-sm font-medium ${authTest.ok ? "text-emerald-600" : "text-crimson"}`}
          >
            {authTest.ok ? "✓" : "✗"} {authTest.msg}
          </span>
        )}
      </div>

      {/* erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Erro ao consultar o extrato:</strong>
          <br />
          <code className="text-xs break-all">{error}</code>
          <p className="mt-2 text-xs text-red-500">
            Verifique se as variáveis de ambiente C6_* estão configuradas corretamente e se o
            sandbox está no horário de funcionamento (seg–sex 07h–22h).
          </p>
        </div>
      )}

      {/* resumo */}
      {transactions !== null && !error && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-line rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Lançamentos</p>
            <p className="text-2xl font-bold text-ink mt-1">{transactions.length}</p>
          </div>
          <div className="bg-white border border-line rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Entradas</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtBRL(creditos)}</p>
          </div>
          <div className="bg-white border border-line rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Saídas</p>
            <p className="text-2xl font-bold text-crimson mt-1">{fmtBRL(debitos)}</p>
          </div>
        </div>
      )}

      {/* lista de transações */}
      {transactions !== null && !error && (
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">
              Nenhuma movimentação no período.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {transactions.map((tx, i) => {
                const signed = txSignedAmount(tx);
                const isCredit = signed >= 0;
                return (
                  <div
                    key={tx.reference ?? tx.local_reference ?? i}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-paper transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isCredit ? "bg-emerald-500" : "bg-crimson"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {txDescription(tx)}
                        </p>
                        <p className="text-xs text-muted">
                          {fmtDate(txDate(tx))}
                          {tx.transaction_type && (
                            <span className="ml-2 bg-paper px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                              {tx.transaction_type.replace(/_/g, " ")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p
                        className={`text-sm font-semibold ${
                          isCredit ? "text-emerald-600" : "text-crimson"
                        }`}
                      >
                        {isCredit ? "+" : ""}
                        {fmtBRL(Math.abs(signed))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* resposta bruta (debug) — aparece mesmo em caso de erro */}
      {showRaw && (
        <div className="bg-gray-950 text-green-400 rounded-xl p-4 overflow-x-auto text-xs font-mono">
          <p className="text-gray-500 mb-2">// resposta bruta da API C6</p>
          <pre className="whitespace-pre-wrap break-all">
            {rawDebug !== null
              ? JSON.stringify(rawDebug, null, 2)
              : error
              ? `// Nenhuma resposta bruta disponível.\n// Erro capturado:\n${error}`
              : "// Sem dados ainda."}
          </pre>
        </div>
      )}

      {/* estado inicial */}
      {transactions === null && !loading && !error && (
        <div className="bg-white border border-line rounded-xl py-20 text-center text-muted text-sm">
          Selecione o período e clique em <strong>Consultar extrato</strong>.
        </div>
      )}
        </>
      )}
    </div>
  );
}
