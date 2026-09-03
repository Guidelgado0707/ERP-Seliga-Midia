"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";
import { StatCard, StatusBadge } from "@/components/Card";
import { currentMonthValue, monthValueRange, monthLabel } from "@/lib/dateUtils";

// Projeto JC roda de maio (começou dia 15/05) a outubro de 2026 — filtro de mês fica restrito a esse período.
const PROJETO_JC_MESES = [
  { value: "2026-05", label: monthLabel(2026, 4) },
  { value: "2026-06", label: monthLabel(2026, 5) },
  { value: "2026-07", label: monthLabel(2026, 6) },
  { value: "2026-08", label: monthLabel(2026, 7) },
  { value: "2026-09", label: monthLabel(2026, 8) },
  { value: "2026-10", label: monthLabel(2026, 9) },
];

function mesInicialProjetoJC() {
  const atual = currentMonthValue();
  const valores = PROJETO_JC_MESES.map((m) => m.value);
  if (valores.includes(atual)) return atual;
  return atual < PROJETO_JC_MESES[0].value ? PROJETO_JC_MESES[0].value : PROJETO_JC_MESES[PROJETO_JC_MESES.length - 1].value;
}

type ContaPagar = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string;
  status: string;
};

type ContaReceber = {
  id: string;
  descricao: string;
  cliente: string;
  valor: number;
  data_vencimento: string;
  status: string;
};

type Ajuste = {
  mes: string;
  lucro_liquido: number;
  observacoes: string | null;
};

type Lancamento = {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  contraparte: string | null;
  valor: number;
  data_vencimento: string;
  status: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProjetoJCPage() {
  const supabase = createClient();
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(mesInicialProjetoJC());

  const [showPagarForm, setShowPagarForm] = useState(false);
  const [showReceberForm, setShowReceberForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "pagar" | "receber">("todos");

  const [formPagar, setFormPagar] = useState({ descricao: "", fornecedor: "", valor: "", data_vencimento: "" });
  const [formReceber, setFormReceber] = useState({ descricao: "", cliente: "", valor: "", data_vencimento: "" });

  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [showAjusteForm, setShowAjusteForm] = useState(false);
  const [ajusteValor, setAjusteValor] = useState("");
  const [savingAjuste, setSavingAjuste] = useState(false);

  const [editando, setEditando] = useState<{
    id: string;
    tipo: "pagar" | "receber";
    descricao: string;
    contraparte: string;
    valor: string;
    data_vencimento: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthValueRange(mes);
    const [p, r, a] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("id, descricao, fornecedor, valor, data_vencimento, status")
        .eq("origem", "projeto_jc")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true }),
      supabase
        .from("contas_receber")
        .select("id, descricao, cliente, valor, data_vencimento, status")
        .eq("origem", "projeto_jc")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .order("data_vencimento", { ascending: true }),
      supabase.from("projeto_jc_ajustes").select("mes, lucro_liquido, observacoes").eq("mes", mes).maybeSingle(),
    ]);
    setPagar(p.data ?? []);
    setReceber(r.data ?? []);
    setAjuste(a.data ?? null);
    setLoading(false);
  }, [supabase, mes]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddPagar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("contas_pagar").insert({
      descricao: formPagar.descricao,
      fornecedor: formPagar.fornecedor || null,
      valor: Number(formPagar.valor),
      data_vencimento: formPagar.data_vencimento,
      origem: "projeto_jc",
    });
    setFormPagar({ descricao: "", fornecedor: "", valor: "", data_vencimento: "" });
    setShowPagarForm(false);
    setSaving(false);
    load();
  }

  async function handleAddReceber(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("contas_receber").insert({
      descricao: formReceber.descricao,
      cliente: formReceber.cliente,
      valor: Number(formReceber.valor),
      data_vencimento: formReceber.data_vencimento,
      origem: "projeto_jc",
    });
    setFormReceber({ descricao: "", cliente: "", valor: "", data_vencimento: "" });
    setShowReceberForm(false);
    setSaving(false);
    load();
  }

  async function marcarComoPago(id: string) {
    await supabase
      .from("contas_pagar")
      .update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10), pago_em: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  async function desfazerPagamento(id: string) {
    await supabase.from("contas_pagar").update({ status: "pendente", data_pagamento: null, pago_em: null }).eq("id", id);
    load();
  }

  async function apagarPagar(id: string) {
    if (!confirm("Tem certeza que deseja apagar esta conta? Essa ação não pode ser desfeita.")) return;
    await supabase.from("contas_pagar").delete().eq("id", id);
    load();
  }

  async function marcarComoRecebido(id: string) {
    await supabase
      .from("contas_receber")
      .update({ status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10), recebido_em: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  async function desfazerRecebimento(id: string) {
    await supabase.from("contas_receber").update({ status: "pendente", data_recebimento: null, recebido_em: null }).eq("id", id);
    load();
  }

  async function apagarReceber(id: string) {
    if (!confirm("Tem certeza que deseja apagar esta conta? Essa ação não pode ser desfeita.")) return;
    await supabase.from("contas_receber").delete().eq("id", id);
    load();
  }

  async function duplicar(l: Lancamento) {
    if (l.tipo === "pagar") {
      await supabase.from("contas_pagar").insert({
        descricao: l.descricao,
        fornecedor: l.contraparte || null,
        valor: l.valor,
        data_vencimento: l.data_vencimento,
        origem: "projeto_jc",
      });
    } else {
      await supabase.from("contas_receber").insert({
        descricao: l.descricao,
        cliente: l.contraparte || "",
        valor: l.valor,
        data_vencimento: l.data_vencimento,
        origem: "projeto_jc",
      });
    }
    load();
  }

  function iniciarEdicao(l: Lancamento) {
    setEditando({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      contraparte: l.contraparte || "",
      valor: String(l.valor),
      data_vencimento: l.data_vencimento,
    });
  }

  async function salvarEdicao() {
    if (!editando) return;
    setSaving(true);
    if (editando.tipo === "pagar") {
      await supabase
        .from("contas_pagar")
        .update({
          descricao: editando.descricao,
          fornecedor: editando.contraparte || null,
          valor: Number(editando.valor),
          data_vencimento: editando.data_vencimento,
        })
        .eq("id", editando.id);
    } else {
      await supabase
        .from("contas_receber")
        .update({
          descricao: editando.descricao,
          cliente: editando.contraparte || "",
          valor: Number(editando.valor),
          data_vencimento: editando.data_vencimento,
        })
        .eq("id", editando.id);
    }
    setSaving(false);
    setEditando(null);
    load();
  }

  function abrirAjusteForm() {
    setAjusteValor(ajuste ? String(ajuste.lucro_liquido) : "");
    setShowAjusteForm(true);
  }

  async function salvarAjuste(e: React.FormEvent) {
    e.preventDefault();
    setSavingAjuste(true);
    await supabase
      .from("projeto_jc_ajustes")
      .upsert({ mes, lucro_liquido: Number(ajusteValor) }, { onConflict: "mes" });
    setSavingAjuste(false);
    setShowAjusteForm(false);
    load();
  }

  async function removerAjuste() {
    if (!confirm("Remover o ajuste de lucro líquido deste mês? O card volta a mostrar o saldo calculado (recebido − pago).")) return;
    await supabase.from("projeto_jc_ajustes").delete().eq("mes", mes);
    load();
  }

  const sum = (rows: { valor: number }[]) => rows.reduce((acc, c) => acc + Number(c.valor), 0);
  const recebidoMes = sum(receber.filter((c) => c.status === "recebido"));
  const pagoMes = sum(pagar.filter((c) => c.status === "pago"));
  const saldoMes = recebidoMes - pagoMes;

  const lancamentos: Lancamento[] = [
    ...pagar.map((c): Lancamento => ({
      id: c.id,
      tipo: "pagar",
      descricao: c.descricao,
      contraparte: c.fornecedor,
      valor: c.valor,
      data_vencimento: c.data_vencimento,
      status: c.status,
    })),
    ...receber.map((c): Lancamento => ({
      id: c.id,
      tipo: "receber",
      descricao: c.descricao,
      contraparte: c.cliente,
      valor: c.valor,
      data_vencimento: c.data_vencimento,
      status: c.status,
    })),
  ].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  const lancamentosFiltrados = lancamentos.filter((l) => filtroTipo === "todos" || l.tipo === filtroTipo);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Projeto JC</p>
          <p className="text-sm text-muted mt-0.5">
            Operação separada da Seliga Mídia, mas que usa a mesma conta corrente
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
          >
            {PROJETO_JC_MESES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setShowReceberForm((s) => !s);
              setShowPagarForm(false);
            }}
            className="text-sm font-medium px-3 py-2 rounded-md bg-ledger text-white hover:bg-ledger-dark transition-colors"
          >
            {showReceberForm ? "Cancelar" : "+ A receber"}
          </button>
          <button
            onClick={() => {
              setShowPagarForm((s) => !s);
              setShowReceberForm(false);
            }}
            className="text-sm font-medium px-3 py-2 rounded-md bg-crimson text-white hover:opacity-90 transition-colors"
          >
            {showPagarForm ? "Cancelar" : "+ A pagar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-2">
        <StatCard label="Recebido no mês" value={formatBRL(recebidoMes)} hint="Entradas do Projeto JC" tone="ledger" />
        <StatCard label="Pago no mês" value={formatBRL(pagoMes)} hint="Saídas do Projeto JC" tone="crimson" />
        <StatCard
          label="Saldo do mês"
          value={formatBRL(saldoMes)}
          hint="Recebido − pago (impacto na conta corrente)"
          tone={saldoMes >= 0 ? "ledger" : "crimson"}
        />
        <StatCard
          label="Lucro líquido real"
          value={formatBRL(ajuste ? ajuste.lucro_liquido : saldoMes)}
          hint={ajuste ? "Ajustado manualmente" : "Sem ajuste — igual ao saldo"}
          tone={(ajuste ? ajuste.lucro_liquido : saldoMes) >= 0 ? "ledger" : "crimson"}
        />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={abrirAjusteForm} className="text-xs font-medium text-ledger-dark hover:underline">
          {ajuste ? "Editar lucro líquido real" : "Definir lucro líquido real deste mês"}
        </button>
        {ajuste && (
          <button onClick={removerAjuste} className="text-xs font-medium text-crimson hover:underline">
            Remover ajuste
          </button>
        )}
      </div>

      {showAjusteForm && (
        <form onSubmit={salvarAjuste} className="bg-white rounded-md shadow-sm p-5 mb-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">
              Lucro líquido real do mês (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              placeholder="Ex: 25624.35"
              value={ajusteValor}
              onChange={(e) => setAjusteValor(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
          </div>
          <button
            disabled={savingAjuste}
            type="submit"
            className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {savingAjuste ? "Salvando..." : "Salvar ajuste"}
          </button>
          <button
            type="button"
            onClick={() => setShowAjusteForm(false)}
            className="text-sm font-medium px-4 py-2.5 rounded-md border border-line text-ink hover:bg-paper transition-colors"
          >
            Cancelar
          </button>
        </form>
      )}

      <p className="text-xs text-muted mb-4 leading-relaxed">
        Os lançamentos daqui somam/subtraem direto no saldo de Conta Corrente do Painel, mas ficam de fora do
        Contas a Pagar/Receber e da DRE da Seliga Mídia — pra não misturar as duas operações. O "Lucro líquido
        real" não altera recebido/pago — é só um valor manual pra registrar o resultado real do mês quando
        difere do saldo calculado (por acertos internos, por exemplo).
      </p>

      {showReceberForm && (
        <form onSubmit={handleAddReceber} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <p className="text-sm font-medium text-ink md:col-span-2">Nova conta a receber (Projeto JC)</p>
          <input
            required
            placeholder="Descrição"
            value={formReceber.descricao}
            onChange={(e) => setFormReceber({ ...formReceber, descricao: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            required
            placeholder="Cliente / contraparte"
            value={formReceber.cliente}
            onChange={(e) => setFormReceber({ ...formReceber, cliente: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Valor (R$)"
            value={formReceber.valor}
            onChange={(e) => setFormReceber({ ...formReceber, valor: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="date"
            value={formReceber.data_vencimento}
            onChange={(e) => setFormReceber({ ...formReceber, data_vencimento: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar conta a receber"}
          </button>
        </form>
      )}

      {showPagarForm && (
        <form onSubmit={handleAddPagar} className="bg-white rounded-md shadow-sm p-5 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <p className="text-sm font-medium text-ink md:col-span-2">Nova conta a pagar (Projeto JC)</p>
          <input
            required
            placeholder="Descrição"
            value={formPagar.descricao}
            onChange={(e) => setFormPagar({ ...formPagar, descricao: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <input
            placeholder="Fornecedor (opcional)"
            value={formPagar.fornecedor}
            onChange={(e) => setFormPagar({ ...formPagar, fornecedor: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Valor (R$)"
            value={formPagar.valor}
            onChange={(e) => setFormPagar({ ...formPagar, valor: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
          />
          <input
            required
            type="date"
            value={formPagar.data_vencimento}
            onChange={(e) => setFormPagar({ ...formPagar, data_vencimento: e.target.value })}
            className="px-3 py-2.5 rounded-md border border-line text-sm md:col-span-2"
          />
          <button
            disabled={saving}
            type="submit"
            className="md:col-span-2 bg-crimson text-white text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar conta a pagar"}
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setFiltroTipo("todos")}
          className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
            filtroTipo === "todos" ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:bg-paper"
          }`}
        >
          Todos ({lancamentos.length})
        </button>
        <button
          onClick={() => setFiltroTipo("receber")}
          className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
            filtroTipo === "receber"
              ? "bg-ledger text-white border-ledger"
              : "bg-white text-ledger-dark border-line hover:bg-paper"
          }`}
        >
          A Receber ({receber.length})
        </button>
        <button
          onClick={() => setFiltroTipo("pagar")}
          className={`text-sm font-medium px-3 py-2 rounded-md border transition-colors ${
            filtroTipo === "pagar"
              ? "bg-crimson text-white border-crimson"
              : "bg-white text-crimson border-line hover:bg-paper"
          }`}
        >
          A Pagar ({pagar.length})
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm">
        {loading && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loading && lancamentosFiltrados.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">
            {lancamentos.length === 0
              ? "Nenhum lançamento do Projeto JC neste mês ainda."
              : "Nenhum lançamento desse tipo neste mês."}
          </p>
        )}
        <div className="divide-y divide-line">
          {lancamentosFiltrados.map((l) => {
            const emEdicao = editando?.id === l.id && editando.tipo === l.tipo;

            if (emEdicao) {
              return (
                <div key={`${l.tipo}-${l.id}`} className="px-5 py-3.5 bg-paper/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={editando.descricao}
                      onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                      placeholder="Descrição"
                      className="px-3 py-2 rounded-md border border-line text-sm sm:col-span-2"
                    />
                    <input
                      value={editando.contraparte}
                      onChange={(e) => setEditando({ ...editando, contraparte: e.target.value })}
                      placeholder={l.tipo === "pagar" ? "Fornecedor" : "Cliente"}
                      className="px-3 py-2 rounded-md border border-line text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editando.valor}
                      onChange={(e) => setEditando({ ...editando, valor: e.target.value })}
                      placeholder="Valor (R$)"
                      className="px-3 py-2 rounded-md border border-line text-sm font-mono"
                    />
                    <input
                      type="date"
                      value={editando.data_vencimento}
                      onChange={(e) => setEditando({ ...editando, data_vencimento: e.target.value })}
                      className="px-3 py-2 rounded-md border border-line text-sm sm:col-span-2"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={salvarEdicao}
                      disabled={saving}
                      className="text-xs font-medium text-white bg-ledger hover:bg-ledger-dark px-3 py-1.5 rounded-md disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button onClick={() => setEditando(null)} className="text-xs font-medium text-muted hover:underline">
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={`${l.tipo}-${l.id}`} className="px-5 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {l.descricao}
                    <span
                      className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        l.tipo === "pagar" ? "bg-crimson-soft text-crimson" : "bg-ledger-soft text-ledger-dark"
                      }`}
                    >
                      {l.tipo === "pagar" ? "A PAGAR" : "A RECEBER"}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {l.contraparte || "—"} · vence em{" "}
                    {new Date(l.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:shrink-0">
                  <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(l.valor))}</span>
                  <StatusBadge status={l.status} />
                  {l.tipo === "pagar" ? (
                    l.status !== "pago" ? (
                      <button onClick={() => marcarComoPago(l.id)} className="text-xs font-medium text-ledger-dark hover:underline">
                        Marcar pago
                      </button>
                    ) : (
                      <button onClick={() => desfazerPagamento(l.id)} className="text-xs font-medium text-amber hover:underline">
                        Desfazer
                      </button>
                    )
                  ) : l.status !== "recebido" ? (
                    <button onClick={() => marcarComoRecebido(l.id)} className="text-xs font-medium text-ledger-dark hover:underline">
                      Marcar recebido
                    </button>
                  ) : (
                    <button onClick={() => desfazerRecebimento(l.id)} className="text-xs font-medium text-amber hover:underline">
                      Desfazer
                    </button>
                  )}
                  <button onClick={() => iniciarEdicao(l)} className="text-xs font-medium text-ink hover:underline">
                    Editar
                  </button>
                  <button onClick={() => duplicar(l)} className="text-xs font-medium text-ledger-dark hover:underline">
                    Duplicar
                  </button>
                  <button
                    onClick={() => (l.tipo === "pagar" ? apagarPagar(l.id) : apagarReceber(l.id))}
                    className="text-xs font-medium text-crimson hover:underline"
                  >
                    Apagar
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
