-- RECEITA JC — Setembro/2026 (contrato fechado, R$ 71.500/mês).
-- Mesma estrutura dos meses anteriores: Projeto X (54.000) + Instagram (17.500).
-- Pendente (a receber) — marca como recebido quando cair. origem=projeto_jc.
-- Idempotente (não duplica se rodar 2x).
begin;

insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem)
select v.descricao, v.cliente, v.valor, '2026-09-30', 'pendente', 'projeto_jc'
from (values
  ('Recebimento Projeto X - Setembro',         'Projeto X',         54000.00),
  ('Recebimento Projeto Instagram - Setembro', 'Projeto Instagram', 17500.00)
) as v(descricao, cliente, valor)
where not exists (
  select 1 from contas_receber c
  where c.descricao = v.descricao
    and c.origem = 'projeto_jc'
    and c.data_vencimento = '2026-09-30'
);

commit;
