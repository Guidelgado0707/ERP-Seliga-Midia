"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { StatCard, StatusBadge } from "@/components/Card";
import { monthOptions, currentMonthValue, monthValueRange, monthRange } from "@/lib/dateUtils";

type Video = {
  id: string;
  nome: string;
  cliente: string;
  status: string;
  data: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VideosPage() {
  const supabase = createClient();
  const [videosAno, setVideosAno] = useState<Video[]>([]);
  const [faturamentoMes, setFaturamentoMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mes, setMes] = useState(currentMonthValue());
  const [filtroCliente, setFiltroCliente] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cliente: "", data: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    cliente: "",
    status: "editado",
    data: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [ano] = mes.split("-").map(Number);
    const { start: inicioAno } = monthRange(ano, 0);
    const { end: fimAno } = monthRange(ano, 11);
    const { start: mesStart, end: mesEnd } = monthValueRange(mes);

    const [v, receber] = await Promise.all([
      supabase
        .from("videos")
        .select("*")
        .gte("data", inicioAno)
        .lte("data", fimAno)
        .order("data", { ascending: true }),
      supabase
        .from("contas_receber")
        .select("valor")
        .eq("origem", "seliga_midia")
        .eq("reembolso", false)
        .gte("data_recebimento", mesStart)
        .lte("data_recebimento", mesEnd),
    ]);
    setVideosAno(v.data ?? []);
    setFaturamentoMes((receber.data ?? []).reduce((acc, r) => acc + Number(r.valor), 0));
    setLoading(false);
  }, [supabase, mes]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("videos").insert({
      nome: form.nome,
      cliente: form.cliente,
      status: form.status,
      data: form.data,
    });
    setForm({ nome: "", cliente: "", status: "editado", data: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function alternarStatus(v: Video) {
    const novo = v.status === "editado" ? "nao_editado" : "editado";
    setVideosAno((vs) => vs.map((x) => (x.id === v.id ? { ...x, status: novo } : x)));
    await supabase.from("videos").update({ status: novo }).eq("id", v.id);
  }

  async function apagarVideo(id: string) {
    if (!confirm("Tem certeza que deseja apagar este vídeo? Essa ação não pode ser desfeita.")) return;
    await supabase.from("videos").delete().eq("id", id);
    load();
  }

  function iniciarEdicao(v: Video) {
    setEditingId(v.id);
    setEditForm({ nome: v.nome, cliente: v.cliente, data: v.data });
  }

  function cancelarEdicao() {
    setEditingId(null);
  }

  async function salvarEdicao(id: string) {
    setSavingEdit(true);
    await supabase
      .from("videos")
      .update({ nome: editForm.nome, cliente: editForm.cliente, data: editForm.data })
      .eq("id", id);
    setSavingEdit(false);
    setEditingId(null);
    load();
  }

  const { start: mesStart, end: mesEnd } = monthValueRange(mes);
  const videosMes = videosAno.filter((v) => v.data >= mesStart && v.data <= mesEnd);

  const clientesDisponiveis = Array.from(new Set(videosMes.map((v) => v.cliente).filter(Boolean))).sort();
  const videosFiltrados = filtroCliente ? videosMes.filter((v) => v.cliente === filtroCliente) : videosMes;

  const qtdAno = videosAno.length;
  const qtdMes = videosMes.length;
  const valorMedioVideo = qtdMes > 0 ? faturamentoMes / qtdMes : 0;

  // resumo por cliente do mês — mesma ideia do quadro físico do escritório:
  // uma barra por cliente comparando quantos vídeos já foram editados vs. o total
  const resumoPorCliente = (() => {
    const porCliente = new Map<string, { editado: number; naoEditado: number }>();
    for (const v of videosMes) {
      const atual = porCliente.get(v.cliente) ?? { editado: 0, naoEditado: 0 };
      if (v.status === "editado") atual.editado += 1;
      else atual.naoEditado += 1;
      porCliente.set(v.cliente, atual);
    }
    return Array.from(porCliente, ([cliente, c]) => ({ cliente, ...c, total: c.editado + c.naoEditado })).sort(
      (a, b) => b.total - a.total
    );
  })();
  const maiorTotalCliente = Math.max(...resumoPorCliente.map((r) => r.total), 1);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Vídeos</p>
          <p className="text-sm text-muted mt-0.5">Agenda de edição e entrega dos vídeos produzidos</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
          >
            {monthOptions(36).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {clientesDisponiveis.length > 0 && (
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
            >
              <option value="">Todos os clientes</option>
              {clientesDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors"
          >
            {showForm ? "Cancelar" : "+ Novo vídeo"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4">
        <StatCard label="Vídeos no ano" value={String(qtdAno)} hint={`Total produzido em ${mes.split("-")[0]}`} tone="ledger" />
        <StatCard label="Vídeos no mês" value={String(qtdMes)} hint="Produzidos no mês selecionado" tone="amber" />
        <StatCard
          label="Valor médio por vídeo"
          value={formatBRL(valorMedioVideo)}
          hint={qtdMes > 0 ? `Faturamento do mês ÷ ${qtdMes} vídeo(s)` : "Sem vídeos no mês pra calcular"}
          tone="ledger"
        />
      </div>

      {resumoPorCliente.length > 0 && (
        <div className="bg-white rounded-md shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-ink">Resumo por cliente</p>
              <p className="text-xs text-muted mt-0.5">Editados x pendentes no mês — clique num cliente pra filtrar a lista</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-ledger" />
                Editado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber" />
                Não editado
              </span>
            </div>
          </div>
          <div className="divide-y divide-line">
            {resumoPorCliente.map((r) => (
              <button
                key={r.cliente}
                onClick={() => setFiltroCliente((atual) => (atual === r.cliente ? "" : r.cliente))}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-paper transition-colors ${
                  filtroCliente === r.cliente ? "bg-paper" : ""
                }`}
              >
                <span className="text-sm text-ink w-32 md:w-40 shrink-0 truncate" title={r.cliente}>
                  {r.cliente}
                </span>
                <span className="flex-1 h-3 rounded-full bg-paper overflow-hidden">
                  <span
                    className="flex h-full rounded-full overflow-hidden"
                    style={{ width: `${(r.total / maiorTotalCliente) * 100}%` }}
                  >
                    {r.editado > 0 && (
                      <span className="bg-ledger h-full" style={{ width: `${(r.editado / r.total) * 100}%` }} />
                    )}
                    {r.editado > 0 && r.naoEditado > 0 && <span className="w-[2px] h-full bg-paper shrink-0" />}
                    {r.naoEditado > 0 && (
                      <span className="bg-amber h-full" style={{ width: `${(r.naoEditado / r.total) * 100}%` }} />
                    )}
                  </span>
                </span>
                <span className="text-xs font-mono tabular text-muted shrink-0 w-14 text-right">
                  {r.editado}/{r.total}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Nome do vídeo"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            required
            placeholder="Cliente"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          >
            <option value="editado">Editado</option>
            <option value="nao_editado">Não editado</option>
          </select>
          <input
            required
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar vídeo"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && videosFiltrados.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">
            {videosMes.length === 0 ? "Nenhum vídeo cadastrado neste mês ainda." : "Nenhum vídeo desse cliente neste mês."}
          </p>
        )}
        <div className="divide-y divide-line">
          {videosFiltrados.map((v) =>
            editingId === v.id ? (
              <div key={v.id} className="px-5 py-4 bg-paper grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  placeholder="Nome do vídeo"
                  className="px-3 py-2 rounded-md border border-line text-sm md:col-span-2"
                />
                <input
                  value={editForm.cliente}
                  onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })}
                  placeholder="Cliente"
                  className="px-3 py-2 rounded-md border border-line text-sm"
                />
                <input
                  value={editForm.data}
                  onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                  type="date"
                  className="px-3 py-2 rounded-md border border-line text-sm"
                />
                <div className="flex gap-2 md:col-span-2">
                  <button
                    onClick={() => salvarEdicao(v.id)}
                    disabled={savingEdit}
                    className="bg-ledger text-white text-xs font-medium px-3 py-2 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
                  >
                    {savingEdit ? "Salvando..." : "Salvar correção"}
                  </button>
                  <button
                    onClick={cancelarEdicao}
                    className="text-xs font-medium px-3 py-2 rounded-md border border-line text-ink hover:bg-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{v.nome}</p>
                  <p className="text-xs text-muted">
                    {v.cliente} · {new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={v.status} />
                  <button
                    onClick={() => alternarStatus(v)}
                    className="text-xs font-medium text-ledger-dark hover:underline"
                  >
                    {v.status === "editado" ? "Marcar não editado" : "Marcar editado"}
                  </button>
                  <button onClick={() => iniciarEdicao(v)} className="text-xs font-medium text-ink hover:underline">
                    Editar
                  </button>
                  <button
                    onClick={() => apagarVideo(v.id)}
                    className="text-xs font-medium text-crimson hover:underline"
                    title="Apagar vídeo"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
