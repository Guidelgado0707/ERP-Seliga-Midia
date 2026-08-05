"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { StatusBadge } from "@/components/Card";
import { monthOptions, currentMonthValue, monthValueRange } from "@/lib/dateUtils";

type Conta = {
  id: string;
  descricao: string;
  cliente: string;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  gera_credito_cliente: boolean;
};

type Categoria = { id: string; nome: string };

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContasAReceberPage() {
  const supabase = createClient();
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mes, setMes] = useState(currentMonthValue());

  const [form, setForm] = useState({
    descricao: "",
    cliente: "",
    valor: "",
    data_vencimento: "",
    categoria_id: "",
    gera_credito_cliente: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthValueRange(mes);
    const [c, cat] = await Promise.all([
      supabase
        .from("contas_receber")
        .select("*")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true }),
      supabase.from("categorias").select("id, nome").in("tipo", ["receber", "ambos"]),
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
    await supabase.from("contas_receber").insert({
      descricao: form.descricao,
      cliente: form.cliente,
      valor: Number(form.valor),
      data_vencimento: form.data_vencimento,
      categoria_id: form.categoria_id || null,
      gera_credito_cliente: form.gera_credito_cliente,
    });
    setForm({ descricao: "", cliente: "", valor: "", data_vencimento: "", categoria_id: "", gera_credito_cliente: false });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function marcarComoRecebido(id: string) {
    await supabase
      .from("contas_receber")
      .update({ status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    load();
  }

  function exportarCSV() {
    const header = ["Descrição", "Cliente", "Valor", "Vencimento", "Recebimento", "Status", "Gera crédito"];
    const rows = contas.map((c) => [
      c.descricao,
      c.cliente,
      String(c.valor).replace(".", ","),
      c.data_vencimento,
      c.data_recebimento ?? "",
      c.status,
      c.gera_credito_cliente ? "Sim" : "Não",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-a-receber-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Contas a Receber</p>
          <p className="text-sm text-muted mt-0.5">Faturamento de clientes</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
          >
            {monthOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
            required
            placeholder="Cliente"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
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
          <label className="flex items-center gap-2 md:col-span-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.gera_credito_cliente}
              onChange={(e) => setForm({ ...form, gera_credito_cliente: e.target.checked })}
              className="rounded border-line"
            />
            Esta nota gera crédito tributário para o cliente
          </label>
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
        {!loading && contas.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma conta cadastrada ainda.</p>
        )}
        <div className="divide-y divide-line">
          {contas.map((c) => (
            <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {c.descricao}
                  {c.gera_credito_cliente && (
                    <span className="ml-2 text-[10px] font-medium text-ledger-dark bg-ledger-soft px-1.5 py-0.5 rounded">
                      GERA CRÉDITO
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {c.cliente} · vence em{" "}
                  {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(c.valor))}</span>
                <StatusBadge status={c.status} />
                {c.status !== "recebido" && (
                  <button
                    onClick={() => marcarComoRecebido(c.id)}
                    className="text-xs font-medium text-ledger-dark hover:underline"
                  >
                    Marcar recebido
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
