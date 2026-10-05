-- CARTÃO AZUL (Itaú) outubro/2026 — fatura fechada em 02/10, vence 10/10. Total R$ 18.388,83.
--   JC     = R$ 9.118,08 (Claude, ChatGPT, Opus Clip, X, outras ferramentas, IOF, Uber,
--            Hostinger (à vista) e Z-API, parcelas Vindi/Lauth e Coris)
--   Seliga = R$ 9.270,75, agrupado por tipo:
--            Viagem 2.523,25 + Compras/Equipamentos 2.660,50 + Alimentação 3.916,67 + Outros 170,33
-- Tudo PENDENTE, vencimento 2026-10-10. Idempotente: apaga só as linhas 'Cartão azul%' deste
-- vencimento que ainda estão pendentes e sem conciliação, e reinsere limpo.
begin;

insert into categorias (nome, tipo, tipo_custo) select 'Viagem', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Viagem');
insert into categorias (nome, tipo, tipo_custo) select 'Compras/Equipamentos', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Compras/Equipamentos');
insert into categorias (nome, tipo, tipo_custo) select 'Alimentação', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Alimentação');
insert into categorias (nome, tipo, tipo_custo) select 'Outros', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Outros');

delete from contas_pagar
where descricao like 'Cartão azul%'
  and data_vencimento = '2026-10-10'
  and status = 'pendente'
  and banco_referencia is null;

-- ---------- JC (origem projeto_jc) ----------
insert into contas_pagar (descricao, valor, data_vencimento, status, origem)
values
  ('Cartão azul - Claude (JC)',                    2695.25, '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - ChatGPT (JC)',                   1236.52, '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Opus Clip (JC)',                 526.53,  '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - X (JC)',                         87.92,   '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Outras ferramentas (JC)',        580.05,  '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - IOF internacional (JC)',         179.43,  '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Uber (JC)',                      2322.83, '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Hostinger (JC)',                 393.98,  '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Z-API (JC)',                     99.99,   '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Lauth/Vindi parcelas (JC)',      602.45,  '2026-10-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Coris parcela (JC)',             393.13,  '2026-10-10', 'pendente', 'projeto_jc');

-- ---------- Seliga (origem seliga_midia), categorizado ----------
insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
values
  ('Cartão azul - Viagem', 2523.25, '2026-10-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Viagem' order by created_at limit 1)),
  ('Cartão azul - Compras/Equipamentos', 2660.50, '2026-10-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Compras/Equipamentos' order by created_at limit 1)),
  ('Cartão azul - Alimentação', 3916.67, '2026-10-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Alimentação' order by created_at limit 1)),
  ('Cartão azul - Outros', 170.33, '2026-10-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Outros' order by created_at limit 1));

-- conferência: JC 9118.08 | Seliga 9270.75 | total 18388.83
select origem, count(*) as itens, sum(valor) as total
from contas_pagar
where descricao like 'Cartão azul%' and data_vencimento = '2026-10-10'
group by origem
union all
select 'TOTAL', count(*), sum(valor)
from contas_pagar
where descricao like 'Cartão azul%' and data_vencimento = '2026-10-10';

commit;
