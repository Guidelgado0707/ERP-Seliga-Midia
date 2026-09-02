"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";

type Socio = { id: string; nome: string; percentual_participacao: number; ativo: boolean };
type Distribuicao = {
  id: string;
  mes_referencia: string;
  lucro_distribuivel: number;
  dividendos_socios: { id: string; socio_id: string; valor: number; pago: boolean }[];
};

type EditandoDividendo = { id: string; valor: string };
type EditandoProLabore = { id: string; valor: string; data_vencimento: string };
type ProLabore = {
  id: string;
  socio_id: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  conta_pagar_id: string | null;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SociosPage() {
  const supabase = createClient();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);
  const [proLabores, setProLabores] = useState<ProLabore[]>([]);
  const [loading, setLoading] = useState(true);

  const [novoSocio, setNovoSocio] = useState({ nome: "", percentual_participacao: "" });
  const [showSocioForm, setShowSocioForm] = useState(false);

  const [novaDistribuicao, setNovaDistribuicao] = useState({ mes: "", lucro: "" });
  const [showDistForm, setShowDistForm] = useState(false);

  const [novoProLabore, setNovoProLabore] = useState({ socio_id: "", valor: "", data: "", jaPago: true });
  const [showProLaboreForm, setShowProLaboreForm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [editandoDividendo, setEditandoDividendo] = useState<EditandoDividendo | null>(null);
  const [editandoProLabore, setEditandoProLabore] = useState<EditandoProLabore | null>(null);

  const [mesResumo, setMesResumo] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    const [s, d, pl] = await Promise.all([
      supabase.from("socios").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("dividendos")
        .select("id, mes_referencia, lucro_distribuivel, dividendos_socios(id, socio_id, valor, pago)")
        .order("mes_referencia", { ascending: false }),
      supabase
        .from("pro_labore")
        .select("id, socio_id, valor, data_vencimento, data_pagamento, status, conta_pagar_id")
        .order("data_vencimento", { ascending: false }),
    ]);
    setSocios(s.data ?? []);
    setDistribuicoes((d.data as any) ?? []);
    setProLabores(pl.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPercentual = socios.reduce((acc, s) => acc + Number(s.percentual_participacao), 0);

  const anoResumo = mesResumo.slice(0, 4);
  const resumoGanhos = useMemo(() => {
    return socios.map((s) => {
      let plMes = 0, plAno = 0, divMes = 0, divAno = 0;
      for (const pl of proLabores) {
        if (pl.socio_id !== s.id || pl.status !== "pago") continue;
        const d = pl.data_pagamento || pl.data_vencimento;
        if (!d) continue;
        if (d.startsWith(anoResumo)) plAno += Number(pl.valor);
        if (d.startsWith(mesResumo)) plMes += Number(pl.valor);
      }
      for (const dist of distribuicoes) {
        const mref = dist.mes_referencia ?? "";
        for (const ds of dist.dividendos_socios) {
          if (ds.socio_id !== s.id || !ds.pago) continue;
          if (mref.startsWith(anoResumo)) divAno += Number(ds.valor);
          if (mref.startsWith(mesResumo)) divMes += Number(ds.valor);
        }
      }
      return { socio: s, plMes, plAno, divMes, divAno, totalMes: plMes + divMes, totalAno: plAno + divAno };
    });
  }, [socios, proLabores, distribuicoes, mesResumo, anoResumo]);

  const totalGeralMes = resumoGanhos.reduce((a, r) => a + r.totalMes, 0);
  const totalGeralAno = resumoGanhos.reduce((a, r) => a + r.totalAno, 0);

  async function handleAddSocio(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("socios").insert({
      nome: novoSocio.nome,
      percentual_participacao: Number(novoSocio.percentual_participacao),
    });
    setNovoSocio({ nome: "", percentual_participacao: "" });
    setShowSocioForm(false);
    setSaving(false);
    load();
  }

  async function handleDistribuir(e: React.FormEvent) {
    e.preventDefault();
    if (socios.length === 0) return;
    setSaving(true);

    const lucro = Number(novaDistribuicao.lucro);
    const mesRef = `${novaDistribuicao.mes}-01`;

    const { data: div } = await supabase
      .from("dividendos")
      .insert({ mes_referencia: mesRef, lucro_distribuivel: lucro })
      .select()
      .single();

    if (div) {
      const linhas = socios.map((s) => ({
        dividendo_id: div.id,
        socio_id: s.id,
        valor: Math.round(lucro * (Number(s.percentual_participacao) / 100) * 100) / 100,
      }));
      await supabase.from("dividendos_socios").insert(linhas);
    }

    setNovaDistribuicao({ mes: "", lucro: "" });
    setShowDistForm(false);
    setSaving(false);
    load();
  }

  async function handleRegistrarProLabore(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const socio = socios.find((s) => s.id === novoProLabore.socio_id);
    const valorNum = Number(novoProLabore.valor);
    const data = novoProLabore.data || new Date().toISOString().slice(0, 10);

    if (novoProLabore.jaPago) {
      const { data: contaPagar } = await supabase
        .from("contas_pagar")
        .insert({
          descricao: `Pró-labore - ${socio?.nome ?? "Sócio"}`,
          valor: valorNum,
          data_vencimento: data,
          data_pagamento: data,
          pago_em: new Date().toISOString(),
          status: "pago",
        })
        .select()
        .single();

      await supabase.from("pro_labore").insert({
        socio_id: novoProLabore.socio_id,
        valor: valorNum,
        data_vencimento: data,
        data_pagamento: data,
        pago_em: new Date().toISOString(),
        status: "pago",
        conta_pagar_id: contaPagar?.id ?? null,
      });
    } else {
      await supabase.from("pro_labore").insert({
        socio_id: novoProLabore.socio_id,
        valor: valorNum,
        data_vencimento: data,
        status: "pendente",
      });
    }

    setNovoProLabore({ socio_id: "", valor: "", data: "", jaPago: true });
    setShowProLaboreForm(false);
    setSaving(false);
    load();
  }

  async function marcarProLaborePago(pl: ProLabore) {
    const socio = socios.find((s) => s.id === pl.socio_id);
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: contaPagar } = await supabase
      .from("contas_pagar")
      .insert({
        descricao: `Pró-labore - ${socio?.nome ?? "Sócio"}`,
        valor: pl.valor,
        data_vencimento: pl.data_vencimento,
        data_pagamento: hoje,
        pago_em: new Date().toISOString(),
        status: "pago",
      })
      .select()
      .single();

    await supabase
      .from("pro_labore")
      .update({
        status: "pago",
        data_pagamento: hoje,
        pago_em: new Date().toISOString(),
        conta_pagar_id: contaPagar?.id ?? null,
      })
      .eq("id", pl.id);
    load();
  }

  async function desfazerProLaborePago(pl: ProLabore) {
    if (pl.conta_pagar_id) {
      await supabase.from("contas_pagar").delete().eq("id", pl.conta_pagar_id);
    }
    await supabase
      .from("pro_labore")
      .update({ status: "pendente", data_pagamento: null, pago_em: null, conta_pagar_id: null })
      .eq("id", pl.id);
    load();
  }

  async function apagarProLabore(pl: ProLabore) {
    if (!confirm("Tem certeza que deseja apagar este pró-labore? Essa ação não pode ser desfeita.")) return;
    await supabase.from("pro_labore").delete().eq("id", pl.id);
    if (pl.conta_pagar_id) {
      await supabase.from("contas_pagar").delete().eq("id", pl.conta_pagar_id);
    }
    load();
  }

  function iniciarEdicaoProLabore(pl: ProLabore) {
    setEditandoProLabore({ id: pl.id, valor: String(pl.valor), data_vencimento: pl.data_vencimento });
  }

  async function salvarEdicaoProLabore() {
    if (!editandoProLabore) return;
    await supabase
      .from("pro_labore")
      .update({
        valor: Number(editandoProLabore.valor),
        data_vencimento: editandoProLabore.data_vencimento,
      })
      .eq("id", editandoProLabore.id);
    setEditandoProLabore(null);
    load();
  }

  async function marcarRecebido(id: string) {
    await supabase
      .from("dividendos_socios")
      .update({
        pago: true,
        data_pagamento: new Date().toISOString().slice(0, 10),
        pago_em: new Date().toISOString(),
      })
      .eq("id", id);
    load();
  }

  async function desfazerRecebido(id: string) {
    await supabase
      .from("dividendos_socios")
      .update({ pago: false, data_pagamento: null, pago_em: null })
      .eq("id", id);
    load();
  }

  async function apagarDividendoSocio(id: string) {
    if (!confirm("Tem certeza que deseja apagar este dividendo? Essa ação não pode ser desfeita.")) return;
    await supabase.from("dividendos_socios").delete().eq("id", id);
    load();
  }

  function iniciarEdicaoDividendo(id: string, valorAtual: number) {
    setEditandoDividendo({ id, valor: String(valorAtual) });
  }

  async function salvarEdicaoDividendo() {
    if (!editandoDividendo) return;
    await supabase
      .from("dividendos_socios")
      .update({ valor: Number(editandoDividendo.valor) })
      .eq("id", editandoDividendo.id);
    setEditandoDividendo(null);
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">Sócios e Dividendos</p>
        <p className="text-sm text-muted mt-0.5">Participação societária e distribuição de lucros</p>
      </div>

      {/* Quanto cada sócio ganhou */}
      <div className="bg-white rounded-md shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-ink">Quanto cada sócio ganhou</p>
            <p className="text-xs text-muted mt-0.5">Pró-labore pago + dividendos recebidos</p>
          </div>
          <input
            type="month"
            value={mesResumo}
            onChange={(e) => setMesResumo(e.target.value)}
            className="px-3 py-2 rounded-md border border-line text-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th className="text-left font-medium px-5 py-2.5">Sócio</th>
                <th className="text-right font-medium px-5 py-2.5">No mês</th>
                <th className="text-right font-medium px-5 py-2.5">No ano ({anoResumo})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resumoGanhos.map((r) => (
                <tr key={r.socio.id}>
                  <td className="px-5 py-3 font-medium text-ink">{r.socio.nome}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono tabular text-ink">{formatBRL(r.totalMes)}</span>
                    {r.totalMes > 0 && (
                      <p className="text-[11px] text-muted mt-0.5">
                        Pró-labore {formatBRL(r.plMes)} · Dividendos {formatBRL(r.divMes)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono tabular text-ink">{formatBRL(r.totalAno)}</span>
                    {r.totalAno > 0 && (
                      <p className="text-[11px] text-muted mt-0.5">
                        Pró-labore {formatBRL(r.plAno)} · Dividendos {formatBRL(r.divAno)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && resumoGanhos.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-muted">
                    Cadastre os sócios pra ver o resumo de ganhos.
                  </td>
                </tr>
              )}
            </tbody>
            {resumoGanhos.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line font-medium">
                  <td className="px-5 py-3 text-ink">Total</td>
                  <td className="px-5 py-3 text-right font-mono tabular text-ink">{formatBRL(totalGeralMes)}</td>
                  <td className="px-5 py-3 text-right font-mono tabular text-ink">{formatBRL(totalGeralAno)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Sócios */}
      <div className="bg-white rounded-md shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">
            Sócios{" "}
            <span className={`text-xs ml-1 ${totalPercentual === 100 ? "text-muted" : "text-crimson"}`}>
              (total: {totalPercentual}%)
            </span>
          </p>
          <button
            onClick={() => setShowSocioForm((s) => !s)}
            className="text-xs font-medium text-ledger-dark hover:underline"
          >
            {showSocioForm ? "Cancelar" : "+ Adicionar sócio"}
          </button>
        </div>

        {showSocioForm && (
          <form onSubmit={handleAddSocio} className="px-5 py-4 border-b border-line flex flex-col md:flex-row gap-3">
            <input
              required
              placeholder="Nome do sócio"
              value={novoSocio.nome}
              onChange={(e) => setNovoSocio({ ...novoSocio, nome: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="% participação"
              value={novoSocio.percentual_participacao}
              onChange={(e) => setNovoSocio({ ...novoSocio, percentual_participacao: e.target.value })}
              className="w-full md:w-40 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
            <button
              disabled={saving}
              type="submit"
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              Salvar
            </button>
          </form>
        )}

        <div className="divide-y divide-line">
          {socios.map((s) => (
            <div key={s.id} className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{s.nome}</p>
              <span className="font-mono tabular text-sm text-muted">{Number(s.percentual_participacao)}%</span>
            </div>
          ))}
          {!loading && socios.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">Cadastre os sócios pra começar a distribuir dividendos.</p>
          )}
        </div>
      </div>

      {/* Pró-labore */}
      <div className="bg-white rounded-md shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Pró-labore</p>
          <button
            onClick={() => setShowProLaboreForm((s) => !s)}
            disabled={socios.length === 0}
            className="text-xs font-medium text-ledger-dark hover:underline disabled:opacity-40"
          >
            {showProLaboreForm ? "Cancelar" : "+ Registrar pró-labore"}
          </button>
        </div>

        {showProLaboreForm && (
          <form
            onSubmit={handleRegistrarProLabore}
            className="px-5 py-4 border-b border-line flex flex-col gap-3"
          >
            <div className="flex flex-col md:flex-row gap-3">
              <select
                required
                value={novoProLabore.socio_id}
                onChange={(e) => setNovoProLabore({ ...novoProLabore, socio_id: e.target.value })}
                className="px-3 py-2.5 rounded-md border border-line text-sm"
              >
                <option value="">Sócio</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                step="0.01"
                placeholder="Valor (R$)"
                value={novoProLabore.valor}
                onChange={(e) => setNovoProLabore({ ...novoProLabore, valor: e.target.value })}
                className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
              />
              <input
                required
                type="date"
                value={novoProLabore.data}
                onChange={(e) => setNovoProLabore({ ...novoProLabore, data: e.target.value })}
                className="px-3 py-2.5 rounded-md border border-line text-sm"
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={novoProLabore.jaPago}
                  onChange={(e) => setNovoProLabore({ ...novoProLabore, jaPago: e.target.checked })}
                  className="rounded border-line"
                />
                Já foi pago (a data acima é a data do pagamento)
              </label>
              <button
                disabled={saving}
                type="submit"
                className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
              >
                {novoProLabore.jaPago ? "Registrar como pago" : "Registrar como pendente"}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-line">
          {proLabores.map((pl) => {
            const socio = socios.find((s) => s.id === pl.socio_id);

            if (editandoProLabore?.id === pl.id) {
              return (
                <div key={pl.id} className="px-5 py-3.5 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-ink flex-1">{socio?.nome ?? "Sócio"}</span>
                  <input
                    value={editandoProLabore.valor}
                    onChange={(e) => setEditandoProLabore({ ...editandoProLabore, valor: e.target.value })}
                    type="number"
                    step="0.01"
                    className="w-28 px-2 py-1.5 rounded-md border border-line text-sm font-mono"
                  />
                  <input
                    value={editandoProLabore.data_vencimento}
                    onChange={(e) => setEditandoProLabore({ ...editandoProLabore, data_vencimento: e.target.value })}
                    type="date"
                    className="px-2 py-1.5 rounded-md border border-line text-sm"
                  />
                  <button
                    onClick={salvarEdicaoProLabore}
                    className="text-xs font-medium text-ledger-dark hover:underline"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditandoProLabore(null)}
                    className="text-xs font-medium text-muted hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              );
            }

            return (
              <div key={pl.id} className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-ink">{socio?.nome ?? "Sócio"}</p>
                  <p className="text-xs text-muted">
                    {pl.status === "pago" && pl.data_pagamento
                      ? `Pago em ${new Date(pl.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}`
                      : `Vence em ${new Date(pl.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(pl.valor))}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pl.status === "pago" ? "bg-ledger-soft text-ledger-dark" : "bg-amber-soft text-amber"
                    }`}
                  >
                    {pl.status === "pago" ? "Pago" : "Pendente"}
                  </span>
                  {pl.status !== "pago" ? (
                    <button
                      onClick={() => marcarProLaborePago(pl)}
                      className="text-xs font-medium text-ledger-dark hover:underline"
                    >
                      Marcar pago
                    </button>
                  ) : (
                    <button
                      onClick={() => desfazerProLaborePago(pl)}
                      className="text-xs font-medium text-amber hover:underline"
                    >
                      Desfazer
                    </button>
                  )}
                  <button
                    onClick={() => iniciarEdicaoProLabore(pl)}
                    className="text-xs font-medium text-ink hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => apagarProLabore(pl)}
                    className="text-xs font-medium text-crimson hover:underline"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            );
          })}
          {!loading && proLabores.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">
              Nenhum pró-labore registrado ainda. Quando marcado como pago, entra automaticamente no Custo do Mês.
            </p>
          )}
        </div>
      </div>

      {/* Distribuições */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Distribuições de dividendos</p>
          <button
            onClick={() => setShowDistForm((s) => !s)}
            disabled={socios.length === 0}
            className="text-xs font-medium text-ledger-dark hover:underline disabled:opacity-40"
          >
            {showDistForm ? "Cancelar" : "+ Nova distribuição"}
          </button>
        </div>

        {showDistForm && (
          <form onSubmit={handleDistribuir} className="px-5 py-4 border-b border-line flex flex-col md:flex-row gap-3">
            <input
              required
              type="month"
              value={novaDistribuicao.mes}
              onChange={(e) => setNovaDistribuicao({ ...novaDistribuicao, mes: e.target.value })}
              className="px-3 py-2.5 rounded-md border border-line text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="Lucro a distribuir (R$)"
              value={novaDistribuicao.lucro}
              onChange={(e) => setNovaDistribuicao({ ...novaDistribuicao, lucro: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
            <button
              disabled={saving}
              type="submit"
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              Calcular e distribuir
            </button>
          </form>
        )}

        <div className="divide-y divide-line">
          {distribuicoes.map((d) => (
            <div key={d.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink capitalize">
                  {new Date(d.mes_referencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </p>
                <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(d.lucro_distribuivel))}</span>
              </div>
              <div className="space-y-1.5">
                {d.dividendos_socios.map((ds) => {
                  const socio = socios.find((s) => s.id === ds.socio_id);

                  if (editandoDividendo?.id === ds.id) {
                    return (
                      <div key={ds.id} className="flex items-center gap-2 text-sm pl-3">
                        <span className="text-muted flex-1">{socio?.nome ?? "Sócio"}</span>
                        <input
                          value={editandoDividendo.valor}
                          onChange={(e) => setEditandoDividendo({ ...editandoDividendo, valor: e.target.value })}
                          type="number"
                          step="0.01"
                          className="w-28 px-2 py-1 rounded-md border border-line text-sm font-mono"
                        />
                        <button
                          onClick={salvarEdicaoDividendo}
                          className="text-xs font-medium text-ledger-dark hover:underline"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditandoDividendo(null)}
                          className="text-xs font-medium text-muted hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={ds.id} className="flex items-center justify-between text-sm pl-3 flex-wrap gap-y-1">
                      <span className="text-muted">{socio?.nome ?? "Sócio"}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular text-ink">{formatBRL(Number(ds.valor))}</span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ds.pago ? "bg-ledger-soft text-ledger-dark" : "bg-amber-soft text-amber"
                          }`}
                        >
                          {ds.pago ? "Recebido" : "Pendente"}
                        </span>
                        {!ds.pago ? (
                          <button
                            onClick={() => marcarRecebido(ds.id)}
                            className="text-xs font-medium text-ledger-dark hover:underline"
                          >
                            Marcar recebido
                          </button>
                        ) : (
                          <button
                            onClick={() => desfazerRecebido(ds.id)}
                            className="text-xs font-medium text-amber hover:underline"
                          >
                            Desfazer
                          </button>
                        )}
                        <button
                          onClick={() => iniciarEdicaoDividendo(ds.id, Number(ds.valor))}
                          className="text-xs font-medium text-ink hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => apagarDividendoSocio(ds.id)}
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
          ))}
          {!loading && distribuicoes.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">Nenhuma distribuição registrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
