-- DIAGNÓSTICO: lista tudo que compõe a "Receita de JC" e o "Custo de JC" na DRE
-- do ano de 2026. Só leitura, não altera nada.

-- 1) Receitas de JC recebidas em 2026 (uma linha por lançamento)
select 'RECEITA' as tipo, data_recebimento as data, descricao, cliente, valor
from contas_receber
where origem = 'projeto_jc'
  and status = 'recebido'
  and data_recebimento >= '2026-01-01' and data_recebimento <= '2026-12-31'
order by data_recebimento;

-- 2) Total das receitas de JC por mês
select to_char(data_recebimento, 'YYYY-MM') as mes, count(*) as qtd, sum(valor) as total_receita_jc
from contas_receber
where origem = 'projeto_jc'
  and status = 'recebido'
  and data_recebimento >= '2026-01-01' and data_recebimento <= '2026-12-31'
group by 1 order by 1;

-- 3) Total geral (deve bater com a linha "Receita de JC" da DRE anual)
select sum(valor) as total_receita_jc_ano_2026
from contas_receber
where origem = 'projeto_jc'
  and status = 'recebido'
  and data_recebimento >= '2026-01-01' and data_recebimento <= '2026-12-31';
