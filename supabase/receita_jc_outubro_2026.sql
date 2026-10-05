-- Receita do Projeto JC — R$ 54.000,00 A RECEBER (pendente), vencimento 30/10/2026.
-- origem=projeto_jc: entra na linha "Receita de JC" da DRE, na aba Projeto JC
-- e no cálculo do Painel. Idempotente (não duplica se rodar de novo).
begin;

insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem)
select 'Receita Projeto JC - outubro', 'Projeto JC', 54000.00, '2026-10-30', 'pendente', 'projeto_jc'
where not exists (
  select 1 from contas_receber
  where origem = 'projeto_jc' and descricao = 'Receita Projeto JC - outubro'
    and data_vencimento = '2026-10-30' and valor = 54000.00
);

-- conferência: deve dar 1 linha de 54000.00 pendente
select descricao, valor, data_vencimento, status, origem
from contas_receber
where origem = 'projeto_jc' and data_vencimento = '2026-10-30';

commit;
