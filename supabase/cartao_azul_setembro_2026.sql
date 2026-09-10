-- CARTÃO AZUL (Itaú Mastercard) — fatura fechada 08/09, a pagar em setembro/2026.
-- Total da fatura R$ 21.109,51 = JC (R$ 9.850,05, separado à mão pelo usuário) +
-- Seliga (R$ 11.259,46, o restante — cartão é 100% da empresa, nada pessoal).
-- JC agrupado por despesa (origem projeto_jc); Seliga como uma linha (origem
-- seliga_midia), pega pela diferença (valor exato). Tudo PENDENTE (a pagar).
-- Vencimento padrão 2026-09-10 (ajuste na tela se precisar). Idempotente.
begin;

-- ---------- JC (origem projeto_jc) ----------
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
  ('Cartão azul - Crédito X (JC)', 29.48)
) as v(descricao, valor)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao and c.origem = 'projeto_jc' and c.data_vencimento = '2026-09-10'
);

-- ---------- Seliga Mídia (origem seliga_midia) ----------
insert into contas_pagar (descricao, valor, data_vencimento, status, origem)
select 'Cartão azul (Mastercard) - Seliga - setembro', 11259.46, '2026-09-10', 'pendente', 'seliga_midia'
where not exists (
  select 1 from contas_pagar c
  where c.descricao = 'Cartão azul (Mastercard) - Seliga - setembro' and c.origem = 'seliga_midia' and c.data_vencimento = '2026-09-10'
);

commit;
