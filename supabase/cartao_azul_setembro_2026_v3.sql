-- CARTÃO AZUL setembro/2026 — VERSÃO 3 (Seliga categorizado por tipo).
-- JC = R$ 12.558,30 (9 despesas do CSV + computadores). Seliga = R$ 8.551,21,
-- agrupado: Viagem 2.353,86 + Compras/Equipamentos 3.296,18 + Outros 2.901,17.
-- Viagem/Compras = leitura aproximada dos prints; Outros fecha o total exato.
-- Substitui as versões anteriores (remove a linha única de Seliga se existir).
-- Tudo PENDENTE, vencimento 2026-09-10. Idempotente.
begin;

-- categorias da parte Seliga
insert into categorias (nome, tipo, tipo_custo) select 'Viagem', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Viagem');
insert into categorias (nome, tipo, tipo_custo) select 'Compras/Equipamentos', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Compras/Equipamentos');
insert into categorias (nome, tipo, tipo_custo) select 'Outros', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Outros');

-- ---------- JC (origem projeto_jc) — insere só o que ainda não existe ----------
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

-- ---------- Seliga (origem seliga_midia), categorizado ----------
-- remove qualquer linha de Seliga do cartão azul (lump antigo ou as 3 categorias) e reinsere limpo
delete from contas_pagar
where origem = 'seliga_midia' and data_vencimento = '2026-09-10'
  and descricao like 'Cartão azul%';

insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
values
  ('Cartão azul - Viagem', 2353.86, '2026-09-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Viagem' order by created_at limit 1)),
  ('Cartão azul - Compras/Equipamentos', 3296.18, '2026-09-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Compras/Equipamentos' order by created_at limit 1)),
  ('Cartão azul - Outros', 2901.17, '2026-09-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Outros' order by created_at limit 1));

commit;
