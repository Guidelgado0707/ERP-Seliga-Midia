-- DIAGNÓSTICO: tudo que foi RECEBIDO em agosto/2026, quebrado por operação,
-- reembolso e categoria. Só leitura. Explica a diferença entre "faturamento"
-- do Painel (só Seliga, sem reembolso) e o total de dinheiro que de fato entrou.

-- 1) Recebido em agosto, agrupado por origem + reembolso + categoria
select
  origem,
  reembolso,
  coalesce((select nome from categorias c where c.id = r.categoria_id), 'Sem categoria') as categoria,
  count(*) as qtd,
  sum(valor) as total
from contas_receber r
where status = 'recebido'
  and data_recebimento >= '2026-08-01' and data_recebimento <= '2026-08-31'
group by origem, reembolso, categoria
order by origem, reembolso, categoria;

-- 2) Totais de agosto (o que o Painel mostra vs o total real que entrou)
select
  sum(valor) filter (where origem = 'seliga_midia' and reembolso = false) as faturamento_painel_seliga,
  sum(valor) filter (where origem = 'seliga_midia' and reembolso = true)  as reembolsos_seliga,
  sum(valor) filter (where origem = 'projeto_jc')                          as recebido_jc,
  sum(valor)                                                               as total_entrou_agosto
from contas_receber
where status = 'recebido'
  and data_recebimento >= '2026-08-01' and data_recebimento <= '2026-08-31';

-- 3) Tem receita de agosto ainda PENDENTE (não marcada como recebida)?
select data_vencimento, descricao, cliente, valor, status
from contas_receber
where status in ('pendente', 'atrasado')
  and data_vencimento >= '2026-08-01' and data_vencimento <= '2026-08-31'
order by data_vencimento;
