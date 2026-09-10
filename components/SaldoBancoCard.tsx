"use client";

import { useCallback, useEffect, useState } from "react";

type SaldoData = {
  configurado: boolean;
  saldo_atual?: number;
  entrou_mes?: number;
  saiu_mes?: number;
  data_ref?: string;
  saldo_ref?: number;
  atualizado_em?: string;
  hoje?: string;
  msg?: string;
  error?: string;
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s?: string) {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function diasAtras(dataISO: string, hoje: string): number {
  const d1 = new Date(dataISO + "T00:00:00Z").getTime();
  const d2 = new Date(hoje + "T00:00:00Z").getTime();
  return Math.floor((d2 - d1) / 86_400_000);
}

/**
 * Card com saldo estimado da conta C6 + movimento do mês (via extrato real).
 * O saldo é derivado: (saldo_ref registrado) + entradas − saídas desde data_ref.
 * User pode ajustar o snapshot quando quiser via botão "ajustar".
 */
export default function SaldoBancoCard() {
  const [data, setData] = useState<SaldoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ saldo: "", data: "", observacao: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/c6bank/saldo", { cache: "no-store" });
      const d: SaldoData = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirEdicao() {
    setForm({
      saldo: data?.saldo_ref ? String(data.saldo_ref) : "",
      data: data?.data_ref ?? new Date().toISOString().slice(0, 10),
      observacao: "",
    });
    setEditando(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch("/api/c6bank/saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldo: Number(form.saldo), data: form.data, observacao: form.observacao }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setEditando(false);
      await carregar();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-line rounded-md shadow-sm p-5">
        <p className="text-sm text-muted">Carregando saldo do C6…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-line rounded-md shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-muted mb-1">Saldo C6</p>
        <p className="text-sm text-crimson">Erro: {error}</p>
        <button onClick={carregar} className="text-xs text-ledger hover:underline mt-2">Tentar de novo</button>
      </div>
    );
  }

  if (!data?.configurado) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-amber-700 mb-1">Saldo C6</p>
        <p className="text-sm text-amber-900 mb-2">Nenhum saldo de referência definido ainda.</p>
        <p className="text-xs text-amber-700 mb-3">Informe seu saldo atual pra o sistema começar a estimar diariamente a partir do extrato real.</p>
        {editando ? (
          <FormEdit form={form} setForm={setForm} onCancel={() => setEditando(false)} onSubmit={salvar} salvando={salvando} />
        ) : (
          <button onClick={abrirEdicao} className="bg-ledger text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ledger-dark">
            Definir saldo
          </button>
        )}
      </div>
    );
  }

  const dias = data.data_ref && data.hoje ? diasAtras(data.data_ref, data.hoje) : 0;
  const antigo = dias > 30;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      {/* Card 1: Saldo atual estimado */}
      <div className="bg-white border border-line rounded-md shadow-sm p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-wide text-muted">Saldo em conta (C6)</p>
          <button onClick={abrirEdicao} className="text-[11px] text-ledger hover:underline">ajustar</button>
        </div>
        <p className={`text-2xl font-bold mt-1 ${(data.saldo_atual ?? 0) >= 0 ? "text-ink" : "text-crimson"}`}>
          {fmtBRL(data.saldo_atual ?? 0)}
        </p>
        <p className={`text-[11px] mt-1 ${antigo ? "text-amber-700" : "text-muted"}`}>
          Base: {fmtBRL(data.saldo_ref ?? 0)} em {fmtDate(data.data_ref)}
          {antigo && " ⚠ atualize"}
        </p>
      </div>

      {/* Card 2: Entrou no mês */}
      <div className="bg-white border border-line rounded-md shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Entrou no C6 no mês</p>
        <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtBRL(data.entrou_mes ?? 0)}</p>
        <p className="text-[11px] text-muted mt-1">Total de entradas reais no extrato</p>
      </div>

      {/* Card 3: Saiu no mês */}
      <div className="bg-white border border-line rounded-md shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Saiu do C6 no mês</p>
        <p className="text-2xl font-bold text-crimson mt-1">{fmtBRL(data.saiu_mes ?? 0)}</p>
        <p className="text-[11px] text-muted mt-1">Total de saídas reais no extrato</p>
      </div>

      {editando && (
        <div className="md:col-span-3 bg-white border border-line rounded-md shadow-sm p-5">
          <FormEdit form={form} setForm={setForm} onCancel={() => setEditando(false)} onSubmit={salvar} salvando={salvando} />
        </div>
      )}
    </div>
  );
}

function FormEdit({
  form, setForm, onCancel, onSubmit, salvando,
}: {
  form: { saldo: string; data: string; observacao: string };
  setForm: (f: { saldo: string; data: string; observacao: string }) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  salvando: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm font-medium text-ink">Definir/ajustar saldo de referência</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Saldo (R$)</label>
          <input required type="number" step="0.01" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })}
            placeholder="Ex: 50000.00"
            className="w-full border border-line rounded-md px-3 py-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Data do saldo</label>
          <input required type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Observação (opcional)</label>
          <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <p className="text-[11px] text-muted">
        O saldo informado é considerado o valor <strong>no fim do dia</strong> da data escolhida. O sistema soma apenas os lançamentos DEPOIS dessa data pra calcular o saldo atual.
      </p>
      <div className="flex gap-2">
        <button disabled={salvando} type="submit" className="bg-ledger text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ledger-dark disabled:opacity-60">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} className="border border-line text-muted text-sm font-medium px-4 py-2 rounded-md hover:bg-paper">
          Cancelar
        </button>
      </div>
    </form>
  );
}
