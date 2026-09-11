"use client";

import React, { useCallback, useEffect, useState } from "react";

type BreakdownItem = { tipo: string; entrada: number; saida: number; qtd: number };
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
  breakdown_mes?: BreakdownItem[];
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
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false);

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
    <div className="space-y-3">
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
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wide text-muted">Entrou no C6 no mês</p>
            <button onClick={() => setMostrarDetalhe((v) => !v)} className="text-[11px] text-ledger hover:underline">
              {mostrarDetalhe ? "ocultar" : "detalhar"}
            </button>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtBRL(data.entrou_mes ?? 0)}</p>
          <p className="text-[11px] text-muted mt-1">
            Operacional: <strong>{fmtBRL(liquidoMes(data.breakdown_mes, "entrada"))}</strong>{" "}
            <span className="text-muted">(sem investimentos/estornos)</span>
          </p>
        </div>

        {/* Card 3: Saiu no mês */}
        <div className="bg-white border border-line rounded-md shadow-sm p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wide text-muted">Saiu do C6 no mês</p>
            <button onClick={() => setMostrarDetalhe((v) => !v)} className="text-[11px] text-ledger hover:underline">
              {mostrarDetalhe ? "ocultar" : "detalhar"}
            </button>
          </div>
          <p className="text-2xl font-bold text-crimson mt-1">{fmtBRL(data.saiu_mes ?? 0)}</p>
          <p className="text-[11px] text-muted mt-1">
            Operacional: <strong>{fmtBRL(liquidoMes(data.breakdown_mes, "saida"))}</strong>{" "}
            <span className="text-muted">(sem investimentos/estornos)</span>
          </p>
        </div>
      </div>

      {mostrarDetalhe && data.breakdown_mes && (
        <div className="bg-white border border-line rounded-md shadow-sm p-5">
          <p className="text-xs uppercase tracking-wide text-muted mb-3">Detalhe do mês por tipo de transação (C6)</p>
          <div className="text-xs">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 items-baseline">
              <div className="font-medium text-muted">Tipo</div>
              <div className="font-medium text-muted text-right">Entradas</div>
              <div className="font-medium text-muted text-right">Saídas</div>
              <div className="font-medium text-muted text-right">Qtd</div>
              {data.breakdown_mes.map((b) => (
                <React.Fragment key={b.tipo}>
                  <div className="text-ink truncate" title={b.tipo}>{rotuloTipo(b.tipo)}</div>
                  <div className="text-right font-mono text-emerald-700">{b.entrada > 0 ? fmtBRL(b.entrada) : "—"}</div>
                  <div className="text-right font-mono text-crimson">{b.saida > 0 ? fmtBRL(b.saida) : "—"}</div>
                  <div className="text-right font-mono text-muted">{b.qtd}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted mt-3">
            💡 Aplicações/resgates de CDB, transferências entre contas próprias e estornos aparecem como movimento
            mas não são receita nem despesa. Se um tipo estiver "inflando" os totais, considere o movimento líquido dele.
          </p>
        </div>
      )}

      {editando && (
        <div className="bg-white border border-line rounded-md shadow-sm p-5">
          <FormEdit form={form} setForm={setForm} onCancel={() => setEditando(false)} onSubmit={salvar} salvando={salvando} />
        </div>
      )}
    </div>
  );
}

// Tipos que NÃO são receita/despesa operacional (dinheiro que sai e volta,
// ou movimento próprio). Excluímos do "operacional" pra dar um número
// mais próximo do que realmente é receita/despesa da operação.
const TIPOS_NAO_OPERACIONAIS = new Set([
  "FUND", "TECH_INVEST", "FIXED_INCOME",  // investimentos (aplicações e resgates)
  "PAYMENT_REVERSAL",                      // estornos
  "GLOBAL_ACCOUNT",                        // conta global (transferência interna)
]);
function liquidoMes(breakdown: BreakdownItem[] | undefined, tipo: "entrada" | "saida"): number {
  if (!breakdown) return 0;
  return breakdown
    .filter((b) => !TIPOS_NAO_OPERACIONAIS.has(b.tipo))
    .reduce((acc, b) => acc + b[tipo], 0);
}

// Rótulos amigáveis pros transaction_types crípticos do C6
function rotuloTipo(t: string): string {
  const map: Record<string, string> = {
    PAYMENT: "Pagamento",
    TRANSFER: "Transferência",
    PAYMENT_REVERSAL: "Estorno",
    PERSONAL_LOAN: "Empréstimo pessoal",
    INSTALLMENT_LOAN: "Empréstimo parcelado",
    PARKY: "Parky",
    TAGGY: "Taggy",
    C6_TAG_PASSAGE: "C6 Tag - passagem",
    C6_TAG_STAY: "C6 Tag - estadia",
    DIRECT_DEBIT_AGREEMENT: "Débito automático",
    GLOBAL_ACCOUNT: "Conta global",
    FUND: "Aplicação/resgate",
    RECHARGE: "Recarga",
    KICK: "Kick",
    PREPAYMENT: "Antecipação",
    CREDIT_CARD_SALE: "Venda cartão crédito",
    DEBIT_CARD_SALE: "Venda cartão débito",
    OVERFLOW: "Overflow",
    CREDIT_PIX_DEVOLUTION_RECEIVED: "PIX devolvido pra gente",
    DEBIT_PIX_DEVOLUTION_SENT: "PIX devolvido pra outro",
    CREDIT_QRCODE_PIX_PAYMENT_RECEIVED: "PIX QR recebido",
    CREDIT_PIX_PAYMENT_RECEIVED: "PIX recebido",
    DEBIT_PIX_PAYMENT_REALIZED: "PIX enviado",
    DEBIT_OPEN_BANKING_PIX_REALIZED: "PIX enviado (Open Banking)",
    VEHICLE_TAX: "IPVA",
    TECH_INVEST: "Tech Invest",
    FIXED_INCOME: "Renda fixa (CDB/aplicação)",
    DEBIT_CARD: "Cartão de débito",
    CREDIT_CARD: "Cartão de crédito",
    OTHER: "Outros",
  };
  return map[t] ?? t;
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
