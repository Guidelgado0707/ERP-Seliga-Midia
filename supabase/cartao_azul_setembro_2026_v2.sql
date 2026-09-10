-- CARTÃO AZUL setembro/2026 — VERSÃO 2 (adiciona a compra dos computadores no JC).
-- A compra de computadores (BeTecnologia, R$ 2.708,25, última parcela) estava na
-- parte de Seliga; move pra JC. Total da fatura continua R$ 21.109,51:
--   JC     = 9.850,05 + 2.708,25 = 12.558,30
--   Seliga = 11.259,46 − 2.708,25 =  8.551,21
-- Seguro rodar tenha ou não rodado a v1 (insere o que falta + corrige a Seliga).
begin;

-- JC: 9 linhas do CSV + a compra dos computadores (insere só o que ainda não existe)
insert into contas_pagar (descricao, valor, data_vencimento, status, origem)
select v.descricao, v.valor, '2026-09-10', 'pendente', 'projeto_jc'
from (values
  ('Cartão azul - Claude (JC)',    3860.77),
  ('Cartão azul - Lauth (JC)',     1682.45),
  ('Cartão azul - Uber (JC)',      1661.49),
  ('Cartão azul - Almoço (JC)',    1048.20),
  ('Cartão azul - ChatGPT (JC)',   825.23),
  ('Cartão azul - Moonshot (JC)',  571.59),
  ('Cartão azul - Z-API (JC)',     99.99),
  ('Cartão azul - Hostinger (JC)', 70.85),
  ('Cartão azul - Crédito X (JC)', 29.48),
  ('Cartão azul - Compra computadores (JC) - última parcela', 2708.25)
) as v(descricao, valor)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao and c.origem = 'projeto_jc' and c.data_vencimento = '2026-09-10'
);

-- Seliga: cria a linha (se ainda não existe) e garante o valor correto de 8.551,21
insert into contas_pagar (descricao, valor, data_vencimento, status, origem)
select 'Cartão azul (Mastercard) - Seliga - setembro', 8551.21, '2026-09-10', 'pendente', 'seliga_midia'
where not exists (
  select 1 from contas_pagar c
  where c.descricao = 'Cartão azul (Mastercard) - Seliga - setembro' and c.origem = 'seliga_midia' and c.data_vencimento = '2026-09-10'
);

update contas_pagar
set valor = 8551.21
where descricao = 'Cartão azul (Mastercard) - Seliga - setembro'
  and origem = 'seliga_midia' and data_vencimento = '2026-09-10';

commit;
