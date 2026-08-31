-- CONTAS A RECEBER — Setembro/2026 (Seliga Mídia). Todas PENDENTES (a receber).
-- origem=seliga_midia. Duas categorias de receita pra separar na DRE:
--   'Seliga Mídia'    → Setta, Fronte, Caixa
--   'Girando na Alta' → as demais (marcas de carro + Festival)
-- data_vencimento padrão 2026-09-05 (ajuste na tela A Receber se precisar).
-- Idempotente (não duplica se rodar 2x).
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Girando na Alta', 'receber', null
where not exists (select 1 from categorias where nome = 'Girando na Alta');

insert into categorias (nome, tipo, tipo_custo)
select 'Seliga Mídia', 'receber', null
where not exists (select 1 from categorias where nome = 'Seliga Mídia');

insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.cliente, v.valor, '2026-09-05', 'pendente', 'seliga_midia',
       (select id from categorias where nome = v.categoria order by created_at limit 1)
from (values
  -- categoria Seliga Mídia
  ('Setta - Parcela 2/6',        'Setta',                12666.67, 'Seliga Mídia'),
  ('Fronte',                     'Fronte',               5000.00,  'Seliga Mídia'),
  ('Caixa',                      'Caixa',                54062.50, 'Seliga Mídia'),
  -- categoria Girando na Alta
  ('Kia',                        'Kia',                  750.00,   'Girando na Alta'),
  ('BYD',                        'BYD',                  2000.00,  'Girando na Alta'),
  ('Bajaj',                      'Bajaj',                1800.00,  'Girando na Alta'),
  ('Iofer',                      'Iofer',                550.00,   'Girando na Alta'),
  ('Shopping do automóvel',      'Shopping do automóvel', 5500.00, 'Girando na Alta'),
  ('Omoda',                      'Omoda',                1800.00,  'Girando na Alta'),
  ('Geely',                      'Geely',                2000.00,  'Girando na Alta'),
  ('Leap',                       'Leap',                 2000.00,  'Girando na Alta'),
  ('Segsat',                     'Segsat',               2000.00,  'Girando na Alta'),
  ('Autonuntes',                 'Autonuntes',           3000.00,  'Girando na Alta'),
  ('Hyundai',                    'Hyundai',              1500.00,  'Girando na Alta'),
  ('BYD - Festival',             'BYD',                  1200.00,  'Girando na Alta'),
  ('Granvia - Festival',         'Granvia',              1200.00,  'Girando na Alta'),
  ('Geely - Festival',           'Geely',                1200.00,  'Girando na Alta'),
  ('Omoda / Jaeco - Festival',   'Omoda / Jaeco',        1200.00,  'Girando na Alta'),
  ('Leap - Festival',            'Leap',                 1200.00,  'Girando na Alta'),
  ('Festival',                   'Festival',             6500.00,  'Girando na Alta')
) as v(descricao, cliente, valor, categoria)
where not exists (
  select 1 from contas_receber c
  where c.descricao = v.descricao
    and c.valor = v.valor
    and c.data_vencimento = '2026-09-05'
    and c.origem = 'seliga_midia'
);

commit;
