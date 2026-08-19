"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import ContratoDocumento, { CRIADORES } from "@/components/ContratoDocumento";

type Contrato = {
  id: string;
  contratante_razao_social: string;
  contratante_cnpj: string;
  contratante_endereco: string;
  contratante_representante: string;
  contratante_email: string;
  criador: string;
  quantidade_videos: number;
  valor_por_video: number;
  data_contrato: string;
  testemunha1_nome: string;
  testemunha1_cpf: string;
  testemunha2_nome: string | null;
  testemunha2_cpf: string | null;
  created_at: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

const FORM_VAZIO = {
  contratante_razao_social: "",
  contratante_cnpj: "",
  contratante_endereco: "",
  contratante_representante: "",
  contratante_email: "",
  criador: CRIADORES[0].id as string,
  quantidade_videos: "1",
  valor_por_video: "",
  data_contrato: hoje(),
  testemunha1_nome: "",
  testemunha1_cpf: "",
  testemunha2_nome: "",
  testemunha2_cpf: "",
};

export default function ContratosPage() {
  const supabase = createClient();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visualizando, setVisualizando] = useState<Contrato | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("contratos").select("*").order("created_at", { ascending: false });
    setContratos(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string, nome: string) {
    if (!window.confirm(`Apagar o contrato de "${nome}"? Essa ação não pode ser desfeita.`)) return;
    setContratos((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("contratos").delete().eq("id", id);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await supabase
      .from("contratos")
      .insert({
        contratante_razao_social: form.contratante_razao_social,
        contratante_cnpj: form.contratante_cnpj,
        contratante_endereco: form.contratante_endereco,
        contratante_representante: form.contratante_representante,
        contratante_email: form.contratante_email,
        criador: form.criador,
        quantidade_videos: Number(form.quantidade_videos),
        valor_por_video: Number(form.valor_por_video),
        data_contrato: form.data_contrato,
        testemunha1_nome: form.testemunha1_nome,
        testemunha1_cpf: form.testemunha1_cpf,
        testemunha2_nome: form.testemunha2_nome || null,
        testemunha2_cpf: form.testemunha2_cpf || null,
      })
      .select()
      .single();
    setForm(FORM_VAZIO);
    setShowForm(false);
    setSaving(false);
    await load();
    if (data) setVisualizando(data as Contrato);
  }

  if (visualizando) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => setVisualizando(null)} className="text-sm font-medium text-ledger-dark hover:underline">
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
          <ContratoDocumento
            contratante_razao_social={visualizando.contratante_razao_social}
            contratante_cnpj={visualizando.contratante_cnpj}
            contratante_endereco={visualizando.contratante_endereco}
            contratante_representante={visualizando.contratante_representante}
            contratante_email={visualizando.contratante_email}
            criador={visualizando.criador}
            quantidade_videos={visualizando.quantidade_videos}
            valor_por_video={Number(visualizando.valor_por_video)}
            data_contrato={visualizando.data_contrato}
            testemunha1_nome={visualizando.testemunha1_nome}
            testemunha1_cpf={visualizando.testemunha1_cpf}
            testemunha2_nome={visualizando.testemunha2_nome}
            testemunha2_cpf={visualizando.testemunha2_cpf}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Contratos</p>
          <p className="text-sm text-muted mt-0.5">Contrato de parceria comercial pronto pra exportar em PDF</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors shrink-0"
        >
          {showForm ? "Cancelar" : "+ Novo contrato"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <p className="text-sm font-medium text-ink md:col-span-2">Contratante (seu cliente)</p>
          <input
            required
            placeholder="Razão Social"
            value={form.contratante_razao_social}
            onChange={(e) => setForm({ ...form, contratante_razao_social: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            required
            placeholder="CNPJ"
            value={form.contratante_cnpj}
            onChange={(e) => setForm({ ...form, contratante_cnpj: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            required
            type="email"
            placeholder="E-mail"
            value={form.contratante_email}
            onChange={(e) => setForm({ ...form, contratante_email: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            required
            placeholder="Endereço"
            value={form.contratante_endereco}
            onChange={(e) => setForm({ ...form, contratante_endereco: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            required
            placeholder="Representante Legal"
            value={form.contratante_representante}
            onChange={(e) => setForm({ ...form, contratante_representante: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />

          <p className="text-sm font-medium text-ink md:col-span-2 mt-2">Contratada (Seliga Mídia)</p>
          <select
            value={form.criador}
            onChange={(e) => setForm({ ...form, criador: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          >
            {CRIADORES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.handle})
              </option>
            ))}
          </select>

          <p className="text-sm font-medium text-ink md:col-span-2 mt-2">Escopo e valores</p>
          <input
            required
            type="number"
            min="1"
            placeholder="Quantidade de vídeos"
            value={form.quantidade_videos}
            onChange={(e) => setForm({ ...form, quantidade_videos: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Valor por vídeo (R$)"
            value={form.valor_por_video}
            onChange={(e) => setForm({ ...form, valor_por_video: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">
              Data do contrato
            </label>
            <input
              required
              type="date"
              value={form.data_contrato}
              onChange={(e) => setForm({ ...form, data_contrato: e.target.value })}
              className="px-3 py-2.5 rounded-md border border-line text-sm"
            />
          </div>
          {form.quantidade_videos && form.valor_por_video && (
            <p className="text-xs text-muted md:col-span-2">
              Valor total: {formatBRL(Number(form.quantidade_videos) * Number(form.valor_por_video))}
            </p>
          )}

          <p className="text-sm font-medium text-ink md:col-span-2 mt-2">Testemunhas</p>
          <input
            required
            placeholder="Testemunha 1 — Nome"
            value={form.testemunha1_nome}
            onChange={(e) => setForm({ ...form, testemunha1_nome: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            required
            placeholder="Testemunha 1 — CPF"
            value={form.testemunha1_cpf}
            onChange={(e) => setForm({ ...form, testemunha1_cpf: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            placeholder="Testemunha 2 — Nome (opcional)"
            value={form.testemunha2_nome}
            onChange={(e) => setForm({ ...form, testemunha2_nome: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            placeholder="Testemunha 2 — CPF (opcional)"
            value={form.testemunha2_cpf}
            onChange={(e) => setForm({ ...form, testemunha2_cpf: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />

          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60 mt-2"
          >
            {saving ? "Salvando..." : "Salvar e gerar contrato"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && contratos.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">Nenhum contrato criado ainda.</p>
        )}
        <div className="divide-y divide-line">
          {contratos.map((c) => {
            const criadorInfo = CRIADORES.find((cr) => cr.id === c.criador);
            return (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{c.contratante_razao_social}</p>
                  <p className="text-xs text-muted">
                    {criadorInfo?.nome ?? c.criador} · {c.quantidade_videos}{" "}
                    {c.quantidade_videos === 1 ? "vídeo" : "vídeos"} ·{" "}
                    {formatBRL(Number(c.valor_por_video))}/vídeo ·{" "}
                    {new Date(c.data_contrato + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular text-sm text-ink">
                    {formatBRL(c.quantidade_videos * Number(c.valor_por_video))}
                  </span>
                  <button
                    onClick={() => setVisualizando(c)}
                    className="text-xs font-medium text-ledger-dark hover:underline"
                  >
                    Ver / Baixar PDF
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.contratante_razao_social)}
                    title="Apagar contrato"
                    aria-label="Apagar contrato"
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
