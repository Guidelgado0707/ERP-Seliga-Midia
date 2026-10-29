-- CONTAS A RECEBER — Novembro/2026 (Seliga Mídia) — 15 itens = R$ 128.549,98 (bate o TOTAL da planilha).
--   'Seliga Mídia'    → Setta, Caixa
--   'Girando na Alta' → as demais (marcas de carro/moto)
-- Tudo PENDENTE. Vencimento 2026-11-30 (mesmo critério de outubro), exceto "JEEP BRASIL - 04/11/2026",
-- que tem a data no próprio item: vence 2026-11-04. Ajuste na tela se precisar.
-- Idempotente: antes de inserir, apaga só as receitas de novembro AINDA pendentes, sem conciliação
-- e que não sejam reembolso — então pode rodar de novo sem duplicar e sem mexer no que já foi baixado.
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Girando na Alta', 'receber', null
where not exists (select 1 from categorias where nome = 'Girando na Alta');

insert into categorias (nome, tipo, tipo_custo)
select 'Seliga Mídia', 'receber', null
where not exists (select 1 from categorias where nome = 'Seliga Mídia');

delete from contas_receber
where origem = 'seliga_midia'
  and coalesce(reembolso, false) = false
  and status = 'pendente'
  and banco_referencia is null
  and data_vencimento between '2026-11-01' and '2026-11-30';

insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.cliente, v.valor, v.vencimento::date, 'pendente', 'seliga_midia',
       (select id from categorias where nome = v.categoria order by created_at limit 1)
from (values
  -- Seliga Mídia
  ('Setta - Parcela 4/6',        'Setta',                 12666.67, '2026-11-30', 'Seliga Mídia'),
  ('Caixa',                      'Caixa',                 62500.00, '2026-11-30', 'Seliga Mídia'),
  -- Girando na Alta
  ('JEEP BRASIL - 04/11/2026',   'Jeep Brasil',           12000.00, '2026-11-04', 'Girando na Alta'),
  ('Nissan',                     'Nissan',                4500.00,  '2026-11-30', 'Girando na Alta'),
  ('GAC nacional - 15/09',       'GAC nacional',          15000.00, '2026-11-30', 'Girando na Alta'),
  ('Tokyo motors (CF motos)',    'Tokyo motors',          3683.31,  '2026-11-30', 'Girando na Alta'),
  ('Kia',                        'Kia',                   750.00,   '2026-11-30', 'Girando na Alta'),
  ('BYD',                        'BYD',                   2000.00,  '2026-11-30', 'Girando na Alta'),
  ('Bajaj',                      'Bajaj',                 1800.00,  '2026-11-30', 'Girando na Alta'),
  ('Iofer',                      'Iofer',                 550.00,   '2026-11-30', 'Girando na Alta'),
  ('Shopping do automóvel',      'Shopping do automóvel', 5500.00,  '2026-11-30', 'Girando na Alta'),
  ('Omoda',                      'Omoda',                 1800.00,  '2026-11-30', 'Girando na Alta'),
  ('Geely',                      'Geely',                 2000.00,  '2026-11-30', 'Girando na Alta'),
  ('Leap',                       'Leap',                  2000.00,  '2026-11-30', 'Girando na Alta'),
  ('Via sul - Jeep',             'Via sul',               1800.00,  '2026-11-30', 'Girando na Alta')
) as v(descricao, cliente, valor, vencimento, categoria);

-- conferência: deve dar 15 linhas e 128549.98
select count(*) as itens, sum(valor) as total
from contas_receber
where origem = 'seliga_midia'
  and coalesce(reembolso, false) = false
  and data_vencimento between '2026-11-01' and '2026-11-30';

commit;
