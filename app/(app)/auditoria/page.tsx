"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";

type LogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  tabela: string;
  registro_id: string | null;
  acao: "insert" | "update" | "delete";
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
};

const TABELA_LABEL: Record<string, string> = {
  contas_pagar: "Contas a Pagar",
  contas_receber: "Contas a Receber",
  dividendos_socios: "Dividendos",
  pro_labore: "Pró-labore",
  caixa_referencia: "Caixa (saldo)",
};

const ACAO_STYLE: Record<string, { label: string; className: string }> = {
  insert: { label: "criou", className: "bg-emerald-50 text-emerald-700" },
  update: { label: "editou", className: "bg-amber-50 text-amber-700" },
  delete: { label: "apagou", className: "bg-red-50 text-crimson" },
};

function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Mostra só os campos que mudaram entre antes/depois (ignora ids/timestamps ruidosos) */
function camposAlterados(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null) {
  const ignorar = new Set(["id", "created_at", "created_by"]);
  if (!antes) return Object.entries(depois ?? {}).filter(([k]) => !ignorar.has(k));
  if (!depois) return Object.entries(antes ?? {}).filter(([k]) => !ignorar.has(k));
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const diffs: Array<[string, unknown, unknown]> = [];
  for (const k of chaves) {
    if (ignorar.has(k)) continue;
    if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) {
      diffs.push([k, antes[k], depois[k]]);
    }
  }
  return diffs;
}

function fmtValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AuditoriaPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTabela, setFiltroTabela] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtroTabela) query = query.eq("tabela", filtroTabela);
    const { data } = await query;
    setLogs((data as LogRow[]) ?? []);
    setLoading(false);
  }, [supabase, filtroTabela]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Auditoria</h1>
          <p className="text-sm text-muted mt-0.5">
            Registro automático de tudo que foi criado, editado ou apagado nas contas
          </p>
        </div>
        <select
          value={filtroTabela}
          onChange={(e) => setFiltroTabela(e.target.value)}
          className="border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger"
        >
          <option value="">Todas as tabelas</option>
          {Object.entries(TABELA_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-line rounded-xl py-20 text-center text-muted text-sm">
          Nenhum registro encontrado.
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl overflow-hidden divide-y divide-line">
          {logs.map((log) => {
            const acao = ACAO_STYLE[log.acao] ?? ACAO_STYLE.update;
            const diffs = camposAlterados(log.dados_antes, log.dados_depois);
            const aberto = expandido === log.id;
            const descricao =
              (log.dados_depois?.descricao as string | undefined) ??
              (log.dados_antes?.descricao as string | undefined) ??
              "—";

            return (
              <div key={log.id} className="px-5 py-3.5">
                <button
                  onClick={() => setExpandido(aberto ? null : log.id)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${acao.className}`}
                    >
                      {acao.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {TABELA_LABEL[log.tabela] ?? log.tabela} · {descricao}
                      </p>
                      <p className="text-xs text-muted">
                        {fmtDateTime(log.created_at)} · {log.user_email ?? "Sistema/importação"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted shrink-0">{aberto ? "▲" : "▼"}</span>
                </button>

                {aberto && (
                  <div className="mt-3 bg-paper rounded-md p-3 text-xs space-y-1.5">
                    {diffs.length === 0 ? (
                      <p className="text-muted">Nenhum campo relevante alterado.</p>
                    ) : (
                      diffs.map(([campo, antes, depois]) => (
                        <div key={campo} className="flex items-start gap-2">
                          <span className="font-mono text-muted shrink-0 w-32 truncate">{campo}</span>
                          {log.acao === "insert" ? (
                            <span className="text-emerald-700">{fmtValor(depois)}</span>
                          ) : log.acao === "delete" ? (
                            <span className="text-crimson line-through">{fmtValor(antes)}</span>
                          ) : (
                            <span>
                              <span className="text-crimson line-through">{fmtValor(antes)}</span>
                              {" → "}
                              <span className="text-emerald-700">{fmtValor(depois)}</span>
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted">
        Mostrando os últimos 200 registros. O log é gravado direto no banco (via trigger), então
        pega qualquer alteração — inclusive fora do sistema.
      </p>
    </div>
  );
}
