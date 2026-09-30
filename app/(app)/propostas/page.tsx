"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import PropostaDocumento, { CRIADORES, type PropostaOpcao } from "@/components/PropostaDocumento";

type Proposta = {
  id: string;
  empresa: string;
  criador: string;
  meses: number;
  opcoes: PropostaOpcao[] | null;
  // legado: propostas criadas antes das opções múltiplas
  quantidade_videos: number | null;
  valor_unitario: number | null;
  resumo: string | null;
  created_at: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// opções sugeridas pra começar o formulário — o usuário apaga as que não usar
// e pode adicionar quantas quiser
const OPCOES_PADRAO = [
  { titulo: "Avulso (por vídeo)", valor: "", detalhe: "" },
  { titulo: "Pacote fechado", valor: "", detalhe: "" },
  { titulo: "Mensal — 3 meses", valor: "", detalhe: "" },
];

// opções efetivas de uma proposta já salva, com fallback pro formato antigo
function opcoesDe(p: Proposta): PropostaOpcao[] {
  if (p.opcoes && p.opcoes.length > 0) return p.opcoes;
  if (p.quantidade_videos && p.valor_unitario) {
    return [
      {
        titulo: "Pacote completo",
        valor: p.quantidade_videos * Number(p.valor_unitario),
        detalhe: `${formatBRL(Number(p.valor_unitario))} por vídeo · ${p.quantidade_videos} vídeos`,
      },
    ];
  }
  return [];
}

export default function PropostasPage() {
  const supabase = createClient();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visualizando, setVisualizando] = useState<Proposta | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    empresa: "",
    criador: CRIADORES[0] as string,
    meses: "3",
    resumo: "",
  });
  const [opcoes, setOpcoes] = useState(OPCOES_PADRAO.map((o) => ({ ...o })));

  function updateOpcao(i: number, field: "titulo" | "valor" | "detalhe", value: string) {
    setOpcoes((os) => os.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  }
  function addOpcao() {
    setOpcoes((os) => [...os, { titulo: "", valor: "", detalhe: "" }]);
  }
  function removeOpcao(i: number) {
    setOpcoes((os) => os.filter((_, idx) => idx !== i));
  }

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

  function resetForm() {
    setForm({ empresa: "", criador: CRIADORES[0], meses: "3", resumo: "" });
    setOpcoes(OPCOES_PADRAO.map((o) => ({ ...o })));
    setEditingId(null);
  }

  function startEdit(p: Proposta) {
    setEditingId(p.id);
    setForm({
      empresa: p.empresa,
      criador: p.criador,
      meses: String(p.meses),
      resumo: p.resumo ?? "",
    });
    const opts = opcoesDe(p);
    setOpcoes(
      opts.length > 0
        ? opts.map((o) => ({ titulo: o.titulo, valor: String(o.valor), detalhe: o.detalhe ?? "" }))
        : OPCOES_PADRAO.map((o) => ({ ...o }))
    );
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const opcoesValidas: PropostaOpcao[] = opcoes
      .filter((o) => o.titulo.trim() && o.valor.trim())
      .map((o) => ({ titulo: o.titulo.trim(), valor: Number(o.valor), detalhe: o.detalhe.trim() || null }));
    if (opcoesValidas.length === 0) {
      window.alert("Preencha pelo menos uma opção de preço (título + valor).");
      return;
    }
    setSaving(true);
    const payload = {
      empresa: form.empresa,
      criador: form.criador,
      meses: Number(form.meses),
      opcoes: opcoesValidas,
      resumo: form.resumo || null,
    };
    const { data } = editingId
      ? await supabase.from("propostas").update(payload).eq("id", editingId).select().single()
      : await supabase.from("propostas").insert(payload).select().single();
    resetForm();
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
            opcoes={opcoesDe(visualizando)}
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
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors shrink-0"
        >
          {showForm ? "Cancelar" : "+ Nova proposta"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {editingId && (
            <p className="text-xs font-medium text-ledger-dark md:col-span-2 -mb-1">Editando proposta existente</p>
          )}
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
            placeholder="Quantidade de meses (pra frase de abertura)"
            value={form.meses}
            onChange={(e) => setForm({ ...form, meses: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono md:col-span-2"
          />

          <div className="md:col-span-2">
            <p className="text-xs font-medium text-muted mb-2">
              Opções de preço — preencha as que quiser oferecer (deixe título e valor em branco pra não incluir)
            </p>
            <div className="space-y-2">
              {opcoes.map((o, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    placeholder="Título (ex: Avulso, Pacote, Mensal)"
                    value={o.titulo}
                    onChange={(e) => updateOpcao(i, "titulo", e.target.value)}
                    className="px-3 py-2 rounded-md border border-line text-sm flex-1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor (R$)"
                    value={o.valor}
                    onChange={(e) => updateOpcao(i, "valor", e.target.value)}
                    className="px-3 py-2 rounded-md border border-line text-sm font-mono sm:w-32"
                  />
                  <input
                    placeholder="Detalhe (opcional)"
                    value={o.detalhe}
                    onChange={(e) => updateOpcao(i, "detalhe", e.target.value)}
                    className="px-3 py-2 rounded-md border border-line text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeOpcao(i)}
                    title="Remover opção"
                    aria-label="Remover opção"
                    className="text-muted hover:text-crimson transition-colors px-2 self-center"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOpcao}
              className="text-xs font-medium text-ledger-dark hover:underline mt-2"
            >
              + Adicionar opção
            </button>
          </div>

          <textarea
            placeholder="Resumo dos vídeos que podemos fazer (opcional — se deixar em branco, usa as frentes de conteúdo padrão)"
            value={form.resumo}
            onChange={(e) => setForm({ ...form, resumo: e.target.value })}
            rows={3}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar e gerar proposta"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && propostas.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma proposta criada ainda.</p>
        )}
        <div className="divide-y divide-line">
          {propostas.map((p) => {
            const opts = opcoesDe(p);
            const valores = opts.map((o) => o.valor);
            const min = valores.length ? Math.min(...valores) : null;
            const max = valores.length ? Math.max(...valores) : null;
            return (
            <div key={p.id} className="px-5 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{p.empresa}</p>
                <p className="text-xs text-muted truncate">
                  {p.criador} · {opts.length === 0 ? "sem opções" : opts.map((o) => o.titulo).join(" · ")} ·{" "}
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap sm:shrink-0">
                {min !== null && (
                  <span className="font-mono tabular text-sm text-ink">
                    {max !== null && max !== min ? `${formatBRL(min)} – ${formatBRL(max)}` : formatBRL(min)}
                  </span>
                )}
                <button
                  onClick={() => setVisualizando(p)}
                  className="text-xs font-medium text-ledger-dark hover:underline"
                >
                  Ver / Baixar PDF
                </button>
                <button
                  onClick={() => startEdit(p)}
                  className="text-xs font-medium text-ledger-dark hover:underline"
                >
                  Editar
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
