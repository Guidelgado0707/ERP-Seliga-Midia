-- Receita do Projeto JC — R$ 25.158,00, recebida em 10/08/2026.
-- origem=projeto_jc: entra na linha "Receita de JC" da DRE, na aba Projeto JC
-- e no cálculo do Painel. Idempotente (não duplica se rodar de novo).
begin;

insert into contas_receber (descricao, cliente, valor, data_vencimento, data_recebimento, recebido_em, status, origem)
select 'Receita Projeto JC - agosto', 'Projeto JC', 25158.00, '2026-08-10', '2026-08-10', '2026-08-10T12:00:00-03:00', 'recebido', 'projeto_jc'
where not exists (
  select 1 from contas_receber
  where origem = 'projeto_jc' and data_recebimento = '2026-08-10' and valor = 25158.00
);

commit;
