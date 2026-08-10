"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import PropostaDocumento, { CRIADORES } from "@/components/PropostaDocumento";

type Proposta = {
  id: string;
  empresa: string;
  criador: string;
  meses: number;
  quantidade_videos: number;
  valor_unitario: number;
  resumo: string | null;
  created_at: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PropostasPage() {
  const supabase = createClient();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visualizando, setVisualizando] = useState<Proposta | null>(null);

  const [form, setForm] = useState({
    empresa: "",
    criador: CRIADORES[0] as string,
    meses: "3",
    quantidade_videos: "",
    valor_unitario: "",
    resumo: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("propostas").select("*").order("created_at", { ascending: false });
    setPropostas(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string, nomeEmpresa: string) {
    if (!window.confirm(`Apagar a proposta de "${nomeEmpresa}"? Essa ação não pode ser desfeita.`)) return;
    setPropostas((ps) => ps.filter((p) => p.id !== id));
    await supabase.from("propostas").delete().eq("id", id);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await supabase
      .from("propostas")
      .insert({
        empresa: form.empresa,
        criador: form.criador,
        meses: Number(form.meses),
        quantidade_videos: Number(form.quantidade_videos),
        valor_unitario: Number(form.valor_unitario),
        resumo: form.resumo || null,
      })
      .select()
      .single();
    setForm({ empresa: "", criador: CRIADORES[0], meses: "3", quantidade_videos: "", valor_unitario: "", resumo: "" });
    setShowForm(false);
    setSaving(false);
    await load();
    if (data) setVisualizando(data as Proposta);
  }

  if (visualizando) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button
            onClick={() => setVisualizando(null)}
            className="text-sm font-medium text-ledger-dark hover:underline"
          >
            ← Voltar
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm font-medium px-4 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors"
          >
            Baixar PDF
          </button>
        </div>
        <div className="shadow-sm rounded-lg overflow-hidden">
          <PropostaDocumento
            empresa={visualizando.empresa}
            criador={visualizando.criador}
            meses={visualizando.meses}
            quantidade_videos={visualizando.quantidade_videos}
            valor_unitario={Number(visualizando.valor_unitario)}
            resumo={visualizando.resumo}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Propostas</p>
          <p className="text-sm text-muted mt-0.5">Proposta comercial pronta pra exportar em PDF</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors shrink-0"
        >
          {showForm ? "Cancelar" : "+ Nova proposta"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Nome da empresa"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <select
            value={form.criador}
            onChange={(e) => setForm({ ...form, criador: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          >
            {CRIADORES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            placeholder="Quantidade de meses"
            value={form.meses}
            onChange={(e) => setForm({ ...form, meses: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="number"
            min="1"
            placeholder="Quantidade de vídeos (total)"
            value={form.quantidade_videos}
            onChange={(e) => setForm({ ...form, quantidade_videos: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Valor unitário por vídeo (R$)"
            value={form.valor_unitario}
            onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono md:col-span-2"
          />
          <textarea
            placeholder="Resumo dos vídeos que podemos fazer (opcional — se deixar em branco, usa as frentes de conteúdo padrão)"
            value={form.resumo}
            onChange={(e) => setForm({ ...form, resumo: e.target.value })}
            rows={3}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          {form.empresa && form.quantidade_videos && form.valor_unitario && (
            <p className="text-xs text-muted md:col-span-2">
              Total: {formatBRL(Number(form.quantidade_videos) * Number(form.valor_unitario))}
              {form.meses && ` · ${Math.round(Number(form.quantidade_videos) / Number(form.meses))} vídeos/mês`}
            </p>
          )}
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar e gerar proposta"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && propostas.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma proposta criada ainda.</p>
        )}
        <div className="divide-y divide-line">
          {propostas.map((p) => (
            <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{p.empresa}</p>
                <p className="text-xs text-muted">
                  {p.criador} · {p.quantidade_videos} vídeos em {p.meses} {p.meses === 1 ? "mês" : "meses"} ·{" "}
                  {formatBRL(Number(p.valor_unitario))}/vídeo · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono tabular text-sm text-ink">
                  {formatBRL(p.quantidade_videos * Number(p.valor_unitario))}
                </span>
                <button
                  onClick={() => setVisualizando(p)}
                  className="text-xs font-medium text-ledger-dark hover:underline"
                >
                  Ver / Baixar PDF
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.empresa)}
                  title="Apagar proposta"
                  aria-label="Apagar proposta"
                  className="text-muted hover:text-crimson transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
