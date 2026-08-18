"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { StatCard, StatusBadge } from "@/components/Card";
import CategoryBarChart from "@/components/CategoryBarChart";
import { monthOptions, currentMonthValue, monthValueRange } from "@/lib/dateUtils";

type Conta = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  categoria_id: string | null;
  forma_pagamento: string | null;
};

type Categoria = { id: string; nome: string };

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContasAPagarPage() {
  const supabase = createClient();
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mes, setMes] = useState(currentMonthValue());
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    descricao: "",
    fornecedor: "",
    valor: "",
    data_vencimento: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [form, setForm] = useState({
    descricao: "",
    fornecedor: "",
    valor: "",
    data_vencimento: "",
    categoria_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthValueRange(mes);
    const [c, cat] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("*")
        .eq("origem", "seliga_midia")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true }),
      supabase.from("categorias").select("id, nome").in("tipo", ["pagar", "ambos"]),
    ]);
    setContas(c.data ?? []);
    setCategorias(cat.data ?? []);
    setLoading(false);
  }, [supabase, mes]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("contas_pagar").insert({
      descricao: form.descricao,
      fornecedor: form.fornecedor || null,
      valor: Number(form.valor),
      data_vencimento: form.data_vencimento,
      categoria_id: form.categoria_id || null,
    });
    setForm({ descricao: "", fornecedor: "", valor: "", data_vencimento: "", categoria_id: "" });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function marcarComoPago(id: string) {
    await supabase
      .from("contas_pagar")
      .update({
        status: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
        pago_em: new Date().toISOString(),
      })
      .eq("id", id);
    load();
  }

  async function desfazerPagamento(id: string) {
    await supabase
      .from("contas_pagar")
      .update({
        status: "pendente",
        data_pagamento: null,
        pago_em: null,
      })
      .eq("id", id);
    load();
  }

  async function apagarConta(id: string) {
    if (!confirm("Tem certeza que deseja apagar esta conta? Essa ação não pode ser desfeita.")) return;
    await supabase.from("contas_pagar").delete().eq("id", id);
    load();
  }

  function iniciarEdicao(c: Conta) {
    setEditingId(c.id);
    setEditForm({
      descricao: c.descricao,
      fornecedor: c.fornecedor ?? "",
      valor: String(c.valor),
      data_vencimento: c.data_vencimento,
    });
  }

  function cancelarEdicao() {
    setEditingId(null);
  }

  async function salvarEdicao(id: string) {
    setSavingEdit(true);
    await supabase
      .from("contas_pagar")
      .update({
        descricao: editForm.descricao,
        fornecedor: editForm.fornecedor || null,
        valor: Number(editForm.valor),
        data_vencimento: editForm.data_vencimento,
      })
      .eq("id", id);
    setSavingEdit(false);
    setEditingId(null);
    load();
  }

  async function atualizarCategoria(id: string, categoria_id: string) {
    // atualiza local primeiro pra não esperar o round-trip
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, categoria_id: categoria_id || null } : c)));
    await supabase
      .from("contas_pagar")
      .update({ categoria_id: categoria_id || null })
      .eq("id", id);
  }

  const formasPagamentoDisponiveis = Array.from(
    new Set(contas.map((c) => c.forma_pagamento).filter((f): f is string => !!f))
  ).sort();

  const contasFiltradas = filtroFormaPagamento
    ? contas.filter((c) => c.forma_pagamento === filtroFormaPagamento)
    : contas;

  const sum = (rows: Conta[]) => rows.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalPago = sum(contasFiltradas.filter((c) => c.status === "pago"));
  const totalPendente = sum(contasFiltradas.filter((c) => c.status === "pendente" || c.status === "atrasado"));
  const totalProvisionado = sum(contasFiltradas.filter((c) => c.status !== "cancelado"));

  const custosPorCategoria = (() => {
    const nomeMap = new Map(categorias.map((c) => [c.id, c.nome]));
    const totals = new Map<string, number>();
    for (const c of contasFiltradas) {
      if (c.status === "cancelado") continue;
      const label = c.categoria_id ? nomeMap.get(c.categoria_id) ?? "Sem categoria" : "Sem categoria";
      totals.set(label, (totals.get(label) ?? 0) + Number(c.valor));
    }
    return Array.from(totals, ([label, value]) => ({ label, value }));
  })();

  const resumoPorCategoria = (() => {
    const nomeMap = new Map(categorias.map((c) => [c.id, c.nome]));
    const dados = new Map<string, { itens: number; valor: number }>();
    for (const c of contasFiltradas) {
      if (c.status === "cancelado") continue;
      const label = c.categoria_id ? nomeMap.get(c.categoria_id) ?? "Sem categoria" : "Sem categoria";
      const atual = dados.get(label) ?? { itens: 0, valor: 0 };
      dados.set(label, { itens: atual.itens + 1, valor: atual.valor + Number(c.valor) });
    }
    return Array.from(dados, ([label, d]) => ({ label, ...d })).sort((a, b) => b.valor - a.valor);
  })();
  const totalResumo = resumoPorCategoria.reduce((acc, r) => acc + r.valor, 0);
  const totalItensResumo = resumoPorCategoria.reduce((acc, r) => acc + r.itens, 0);

  function exportarCSV() {
    const header = ["Descrição", "Fornecedor", "Valor", "Vencimento", "Pagamento", "Status", "Forma de pagamento"];
    const rows = contasFiltradas.map((c) => [
      c.descricao,
      c.fornecedor ?? "",
      String(c.valor).replace(".", ","),
      c.data_vencimento,
      c.data_pagamento ?? "",
      c.status,
      c.forma_pagamento ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-a-pagar-${mes}${filtroFormaPagamento ? "-" + filtroFormaPagamento : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Contas a Pagar</p>
          <p className="text-sm text-muted mt-0.5">Fornecedores, salários, impostos e despesas</p>
        </div>
        <div className="flex gap-2 shrink-0">
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
          {formasPagamentoDisponiveis.length > 0 && (
            <select
              value={filtroFormaPagamento}
              onChange={(e) => setFiltroFormaPagamento(e.target.value)}
              className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
            >
              <option value="">Todas as formas de pagamento</option>
              {formasPagamentoDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportarCSV}
            className="text-sm font-medium px-3 py-2 rounded-md border border-line text-ink hover:bg-white transition-colors"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nova conta"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4">
        <StatCard label="Provisionado do mês" value={formatBRL(totalProvisionado)} hint="Pago + pendente" tone="amber" />
        <StatCard label="Já pago" value={formatBRL(totalPago)} hint="Contas quitadas no mês" tone="ledger" />
        <StatCard label="Pendente" value={formatBRL(totalPendente)} hint="Ainda não paguei" tone="crimson" />
      </div>

      <div className="bg-white rounded-md shadow-sm mb-4">
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-medium text-ink">Custos por categoria</p>
          <p className="text-xs text-muted mt-0.5">Ajuda a ver onde cortar — categorize as contas na lista abaixo</p>
        </div>
        <CategoryBarChart items={custosPorCategoria} />
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            placeholder="Fornecedor"
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <select
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          >
            <option value="">Categoria (opcional)</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <input
            required
            type="number"
            step="0.01"
            placeholder="Valor (R$)"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="date"
            value={form.data_vencimento}
            onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar conta"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && contasFiltradas.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">
            {contas.length === 0 ? "Nenhuma conta cadastrada ainda." : "Nenhuma conta com essa forma de pagamento neste mês."}
          </p>
        )}
        <div className="divide-y divide-line">
          {contasFiltradas.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="px-5 py-4 bg-paper grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                  placeholder="Descrição"
                  className="px-3 py-2 rounded-md border border-line text-sm md:col-span-2"
                />
                <input
                  value={editForm.fornecedor}
                  onChange={(e) => setEditForm({ ...editForm, fornecedor: e.target.value })}
                  placeholder="Fornecedor"
                  className="px-3 py-2 rounded-md border border-line text-sm"
                />
                <input
                  value={editForm.valor}
                  onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                  type="number"
                  step="0.01"
                  placeholder="Valor (R$)"
                  className="px-3 py-2 rounded-md border border-line text-sm font-mono"
                />
                <input
                  value={editForm.data_vencimento}
                  onChange={(e) => setEditForm({ ...editForm, data_vencimento: e.target.value })}
                  type="date"
                  className="px-3 py-2 rounded-md border border-line text-sm"
                />
                <div className="flex gap-2 md:col-span-2">
                  <button
                    onClick={() => salvarEdicao(c.id)}
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
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {c.descricao}
                    {c.forma_pagamento && (
                      <span className="ml-2 text-[10px] font-medium text-muted bg-paper border border-line px-1.5 py-0.5 rounded">
                        {c.forma_pagamento}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {c.fornecedor || "—"} · vence em{" "}
                    {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={c.categoria_id ?? ""}
                    onChange={(e) => atualizarCategoria(c.id, e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-line bg-white text-muted max-w-[140px]"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(c.valor))}</span>
                  <StatusBadge status={c.status} />
                  {c.status !== "pago" ? (
                    <button
                      onClick={() => marcarComoPago(c.id)}
                      className="text-xs font-medium text-ledger-dark hover:underline"
                    >
                      Marcar pago
                    </button>
                  ) : (
                    <button
                      onClick={() => desfazerPagamento(c.id)}
                      className="text-xs font-medium text-amber hover:underline"
                    >
                      Desfazer
                    </button>
                  )}
                  <button
                    onClick={() => iniciarEdicao(c)}
                    className="text-xs font-medium text-ink hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => apagarConta(c.id)}
                    className="text-xs font-medium text-crimson hover:underline"
                    title="Apagar conta"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {resumoPorCategoria.length > 0 && (
        <div className="bg-white rounded-md shadow-sm mt-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <p className="text-sm font-medium text-ink">Resumo por categoria</p>
            <p className="text-xs text-muted mt-0.5">Categoria, quantidade de lançamentos e valor total do mês</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-muted uppercase tracking-wide text-left">
                  <th className="px-5 py-2.5">Categoria</th>
                  <th className="px-5 py-2.5 text-right">Itens</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {resumoPorCategoria.map((r) => (
                  <tr key={r.label}>
                    <td className="px-5 py-2.5 text-ink">{r.label}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular text-muted">{r.itens}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular text-ink">{formatBRL(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-medium">
                  <td className="px-5 py-2.5 text-ink">Total</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular text-ink">{totalItensResumo}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular text-ink">{formatBRL(totalResumo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
