"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";

type Categoria = { id: string; nome: string };

type ItemExtraido = {
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  categoria_sugerida: string;
};

type LinhaRevisao = {
  key: string;
  incluir: boolean;
  data: string;
  descricao: string;
  valor: string;
  categoriaValor: string; // "" | categoria_id | "__new__:Nome"
};

type FaturaImportada = {
  id: string;
  forma_pagamento: string;
  data_pagamento: string;
  quantidade_itens: number;
  valor_total: number;
  created_at: string;
  arquivos: string[];
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let keyCounter = 0;
function novaKey() {
  keyCounter += 1;
  return `linha-${Date.now()}-${keyCounter}`;
}

export default function FaturasPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [historico, setHistorico] = useState<FaturaImportada[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const [formaPagamento, setFormaPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[] | null>(null);

  const load = useCallback(async () => {
    setLoadingHistorico(true);
    const [catRes, formaRes, histRes] = await Promise.all([
      supabase.from("categorias").select("id, nome").in("tipo", ["pagar", "ambos"]),
      supabase.from("contas_pagar").select("forma_pagamento").not("forma_pagamento", "is", null),
      supabase
        .from("faturas_importadas")
        .select("id, forma_pagamento, data_pagamento, quantidade_itens, valor_total, created_at, arquivos")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setCategorias(catRes.data ?? []);
    setFormasPagamento(Array.from(new Set((formaRes.data ?? []).map((r) => r.forma_pagamento).filter(Boolean))) as string[]);
    setHistorico(histRes.data ?? []);
    setLoadingHistorico(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removerArquivo(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function processarComIA() {
    setErro(null);
    if (!formaPagamento.trim()) {
      setErro("Preenche a forma de pagamento (ex: Cartão Azul).");
      return;
    }
    if (!dataPagamento) {
      setErro("Preenche a data de pagamento da fatura.");
      return;
    }
    if (files.length === 0) {
      setErro("Anexa pelo menos uma foto ou arquivo da fatura.");
      return;
    }

    setProcessing(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("categorias", categorias.map((c) => c.nome).join(", "));

      const resp = await fetch("/api/parse-fatura", { method: "POST", body: fd });
      const data = await resp.json();

      if (!resp.ok) {
        setErro(data.error || "Erro ao processar a fatura.");
        setProcessing(false);
        return;
      }

      const nomeParaId = new Map(categorias.map((c) => [c.nome.trim().toLowerCase(), c.id]));
      const novasLinhas: LinhaRevisao[] = (data.itens as ItemExtraido[]).map((item) => {
        const nomeSugerido = (item.categoria_sugerida || "").trim();
        const idExistente = nomeParaId.get(nomeSugerido.toLowerCase());
        const categoriaValor = idExistente ? idExistente : nomeSugerido ? `__new__:${nomeSugerido}` : "";
        return {
          key: novaKey(),
          incluir: true,
          data: item.data || "",
          descricao: item.descricao || "",
          valor: Number.isFinite(item.valor) ? String(item.valor) : "0",
          categoriaValor,
        };
      });

      if (novasLinhas.length === 0) {
        setErro("A IA não encontrou nenhum lançamento nas imagens. Confere se o arquivo está legível.");
        setProcessing(false);
        return;
      }

      setLinhas(novasLinhas);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao processar a fatura.");
    }
    setProcessing(false);
  }

  function atualizarLinha(key: string, patch: Partial<LinhaRevisao>) {
    setLinhas((ls) => (ls ? ls.map((l) => (l.key === key ? { ...l, ...patch } : l)) : ls));
  }

  function removerLinha(key: string) {
    setLinhas((ls) => (ls ? ls.filter((l) => l.key !== key) : ls));
  }

  function adicionarLinhaManual() {
    setLinhas((ls) => [
      ...(ls ?? []),
      { key: novaKey(), incluir: true, data: "", descricao: "", valor: "", categoriaValor: "" },
    ]);
  }

  function cancelarRevisao() {
    setLinhas(null);
    setErro(null);
  }

  const linhasIncluidas = (linhas ?? []).filter((l) => l.incluir && l.descricao.trim() && l.valor.trim());
  const totalIncluido = linhasIncluidas.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

  // opções de categoria disponíveis no select, incluindo sugestões novas ainda não criadas
  function opcoesCategoria(categoriaValorAtual: string) {
    const opcoes = categorias.map((c) => ({ value: c.id, label: c.nome }));
    if (categoriaValorAtual.startsWith("__new__:")) {
      const nome = categoriaValorAtual.replace("__new__:", "");
      opcoes.push({ value: categoriaValorAtual, label: `✨ Nova: ${nome}` });
    }
    return opcoes;
  }

  async function confirmarELancar() {
    if (linhasIncluidas.length === 0) {
      setErro("Marca pelo menos um lançamento pra confirmar.");
      return;
    }
    setConfirmando(true);
    setErro(null);

    try {
      // 1) cria categorias novas sugeridas (dedup)
      const novasCategoriasNomes = Array.from(
        new Set(
          linhasIncluidas
            .filter((l) => l.categoriaValor.startsWith("__new__:"))
            .map((l) => l.categoriaValor.replace("__new__:", ""))
        )
      );
      const nomeParaIdCriado = new Map<string, string>();
      for (const nome of novasCategoriasNomes) {
        const { data: nova } = await supabase
          .from("categorias")
          .insert({ nome, tipo: "pagar", tipo_custo: "variavel" })
          .select("id")
          .single();
        if (nova) nomeParaIdCriado.set(nome, nova.id);
      }

      // 2) monta os inserts de contas_pagar
      const inserts = linhasIncluidas.map((l) => {
        let categoriaId: string | null = null;
        if (l.categoriaValor.startsWith("__new__:")) {
          categoriaId = nomeParaIdCriado.get(l.categoriaValor.replace("__new__:", "")) ?? null;
        } else if (l.categoriaValor) {
          categoriaId = l.categoriaValor;
        }
        return {
          descricao: l.data ? `${l.descricao} - ${l.data}` : l.descricao,
          categoria_id: categoriaId,
          valor: Number(l.valor),
          data_vencimento: dataPagamento,
          data_pagamento: dataPagamento,
          pago_em: `${dataPagamento}T12:00:00-03:00`,
          status: "pago",
          origem: "seliga_midia",
          forma_pagamento: formaPagamento.trim(),
        };
      });

      const { error: insertError } = await supabase.from("contas_pagar").insert(inserts);
      if (insertError) throw insertError;

      // 3) sobe os arquivos originais pro storage (pra referência futura)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const arquivosSalvos: string[] = [];
      for (const file of files) {
        const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("faturas").upload(path, file);
        if (!uploadError) arquivosSalvos.push(path);
      }

      // 4) registra no histórico
      await supabase.from("faturas_importadas").insert({
        forma_pagamento: formaPagamento.trim(),
        data_pagamento: dataPagamento,
        arquivos: arquivosSalvos,
        quantidade_itens: linhasIncluidas.length,
        valor_total: totalIncluido,
      });

      // reset
      setLinhas(null);
      setFiles([]);
      setFormaPagamento("");
      setDataPagamento("");
      load();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao lançar as contas.");
    }
    setConfirmando(false);
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">Importar Fatura</p>
        <p className="text-sm text-muted mt-0.5">
          Manda foto ou arquivo da fatura do cartão — a IA lê linha por linha e sugere a categoria de cada item
        </p>
      </div>

      {erro && (
        <div className="bg-crimson-soft border border-crimson/30 rounded-md p-4 mb-4 text-sm text-crimson">{erro}</div>
      )}

      {!linhas && (
        <div className="bg-white rounded-md shadow-sm p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">
                Forma de pagamento
              </label>
              <input
                list="formas-pagamento-existentes"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                placeholder="Ex: Cartão Azul"
                className="w-full px-3 py-2.5 rounded-md border border-line text-sm"
              />
              <datalist id="formas-pagamento-existentes">
                {formasPagamento.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">
                Data de pagamento da fatura
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-line text-sm"
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-ledger text-white text-sm font-medium py-3.5 rounded-md hover:bg-ledger-dark transition-colors mb-3"
          >
            📷 Adicionar fotos / arquivo da fatura
          </button>

          {files.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-paper rounded-md px-3 py-2">
                  <span className="text-ink truncate">{f.name}</span>
                  <button onClick={() => removerArquivo(i)} className="text-xs text-crimson hover:underline shrink-0 ml-2">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={processarComIA}
            disabled={processing}
            className="w-full bg-ink text-white text-sm font-medium py-3 rounded-md hover:opacity-90 transition-colors disabled:opacity-60"
          >
            {processing ? "Lendo a fatura com IA... (pode levar até 1 minuto)" : "✨ Processar com IA"}
          </button>
        </div>
      )}

      {linhas && (
        <div className="bg-white rounded-md shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-ink">Confere antes de lançar</p>
              <p className="text-xs text-muted mt-0.5">
                {formaPagamento} · vence em {dataPagamento ? new Date(dataPagamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"} ·
                leitura de imagem pode errar dígito, então revisa os valores
              </p>
            </div>
            <p className="font-mono tabular text-lg font-semibold text-ink">
              {linhasIncluidas.length} itens · {formatBRL(totalIncluido)}
            </p>
          </div>

          <div className="divide-y divide-line">
            {linhas.map((l) => (
              <div key={l.key} className="px-5 py-3 flex items-center gap-2 flex-wrap">
                <input
                  type="checkbox"
                  checked={l.incluir}
                  onChange={(e) => atualizarLinha(l.key, { incluir: e.target.checked })}
                  className="rounded border-line shrink-0"
                />
                <input
                  value={l.data}
                  onChange={(e) => atualizarLinha(l.key, { data: e.target.value })}
                  placeholder="DD/MM"
                  className="w-16 px-2 py-1.5 rounded-md border border-line text-xs shrink-0"
                />
                <input
                  value={l.descricao}
                  onChange={(e) => atualizarLinha(l.key, { descricao: e.target.value })}
                  placeholder="Descrição"
                  className="flex-1 min-w-[140px] px-2 py-1.5 rounded-md border border-line text-sm"
                />
                <select
                  value={l.categoriaValor}
                  onChange={(e) => atualizarLinha(l.key, { categoriaValor: e.target.value })}
                  className="text-xs px-2 py-1.5 rounded-md border border-line bg-white text-muted max-w-[160px] shrink-0"
                >
                  <option value="">Sem categoria</option>
                  {opcoesCategoria(l.categoriaValor).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={l.valor}
                  onChange={(e) => atualizarLinha(l.key, { valor: e.target.value })}
                  type="number"
                  step="0.01"
                  className="w-24 px-2 py-1.5 rounded-md border border-line text-sm font-mono text-right shrink-0"
                />
                <button
                  onClick={() => removerLinha(l.key)}
                  className="text-xs font-medium text-crimson hover:underline shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-line">
            <button onClick={adicionarLinhaManual} className="text-xs font-medium text-ledger-dark hover:underline">
              + Adicionar linha manual
            </button>
          </div>

          <div className="px-5 py-4 border-t border-line bg-paper flex items-center gap-3 flex-wrap">
            <button
              onClick={confirmarELancar}
              disabled={confirmando}
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              {confirmando ? "Lançando..." : `Confirmar e lançar ${linhasIncluidas.length} itens (${formatBRL(totalIncluido)})`}
            </button>
            <button
              onClick={cancelarRevisao}
              disabled={confirmando}
              className="text-sm font-medium px-4 py-2.5 rounded-md border border-line text-ink hover:bg-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm">
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-medium text-ink">Faturas já importadas</p>
        </div>
        {loadingHistorico && <p className="px-5 py-6 text-sm text-muted">Carregando...</p>}
        {!loadingHistorico && historico.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma fatura importada ainda.</p>
        )}
        <div className="divide-y divide-line">
          {historico.map((h) => (
            <div key={h.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{h.forma_pagamento}</p>
                <p className="text-xs text-muted">
                  {h.quantidade_itens} itens · paga em{" "}
                  {new Date(h.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="font-mono tabular text-sm text-ink shrink-0">{formatBRL(Number(h.valor_total))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
