-- CONTAS A RECEBER — Setembro/2026 (Seliga Mídia) — VERSÃO 2 (bate a imagem: 22 itens = R$ 112.429,17).
-- Corrige a v1: faltavam 'Via sul - Jeep' (1.800) e 'autoline Hoda' (3.500) e havia divergência no Caixa.
-- Estratégia: apaga TODAS as receitas de setembro (origem seliga_midia, não-reembolso) e reinsere limpo.
--   'Seliga Mídia'    → Setta, Fronte, Caixa
--   'Girando na Alta' → as demais (marcas de carro + Festival), incluindo Via sul/Jeep e autoline/Honda
-- Tudo PENDENTE, vencimento 2026-09-05 (ajuste na tela se precisar). Preserva linhas de reembolso.
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Girando na Alta', 'receber', null
where not exists (select 1 from categorias where nome = 'Girando na Alta');

insert into categorias (nome, tipo, tipo_custo)
select 'Seliga Mídia', 'receber', null
where not exists (select 1 from categorias where nome = 'Seliga Mídia');

-- limpa as receitas de setembro (não mexe em reembolso)
delete from contas_receber
where origem = 'seliga_midia'
  and coalesce(reembolso, false) = false
  and data_vencimento between '2026-09-01' and '2026-09-30';

-- reinsere os 22 itens exatos da imagem
insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.cliente, v.valor, '2026-09-05', 'pendente', 'seliga_midia',
       (select id from categorias where nome = v.categoria order by created_at limit 1)
from (values
  -- Seliga Mídia
  ('Setta - Parcela 2/6',        'Setta',                 12666.67, 'Seliga Mídia'),
  ('Fronte',                     'Fronte',                5000.00,  'Seliga Mídia'),
  ('Caixa',                      'Caixa',                 54062.50, 'Seliga Mídia'),
  -- Girando na Alta
  ('Kia',                        'Kia',                   750.00,   'Girando na Alta'),
  ('BYD',                        'BYD',                   2000.00,  'Girando na Alta'),
  ('Bajaj',                      'Bajaj',                 1800.00,  'Girando na Alta'),
  ('Iofer',                      'Iofer',                 550.00,   'Girando na Alta'),
  ('Shopping do automóvel',      'Shopping do automóvel', 5500.00,  'Girando na Alta'),
  ('Omoda',                      'Omoda',                 1800.00,  'Girando na Alta'),
  ('Geely',                      'Geely',                 2000.00,  'Girando na Alta'),
  ('Leap',                       'Leap',                  2000.00,  'Girando na Alta'),
  ('Via sul - Jeep',            'Via sul',                1800.00,  'Girando na Alta'),
  ('autoline Hoda',             'autoline',               3500.00,  'Girando na Alta'),
  ('Segsat',                     'Segsat',                2000.00,  'Girando na Alta'),
  ('Autonuntes',                 'Autonuntes',            3000.00,  'Girando na Alta'),
  ('Hyundai',                    'Hyundai',               1500.00,  'Girando na Alta'),
  ('BYD - Festival',             'BYD',                   1200.00,  'Girando na Alta'),
  ('Granvia - Festival',         'Granvia',               1200.00,  'Girando na Alta'),
  ('Geely - Festival',           'Geely',                 1200.00,  'Girando na Alta'),
  ('Omoda / Jaeco - Festival',   'Omoda / Jaeco',         1200.00,  'Girando na Alta'),
  ('Leeap - Festival',           'Leeap',                 1200.00,  'Girando na Alta'),
  ('Festival',                   'Festival',              6500.00,  'Girando na Alta')
) as v(descricao, cliente, valor, categoria);

commit;
