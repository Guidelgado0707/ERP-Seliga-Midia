-- CONTAS A RECEBER — Outubro/2026 (Seliga Mídia) — 16 itens = R$ 110.549,98 (bate o TOTAL da planilha).
--   'Seliga Mídia'    → Setta, Caixa
--   'Girando na Alta' → as demais (marcas de carro/moto)
-- Tudo PENDENTE, vencimento 2026-10-05 (ajuste na tela se precisar). Na planilha, Autonuntes (6.000)
-- e Caixa (50.000) aparecem como PAGO, mas entram pendentes pra a Conciliação do banco dar baixa
-- (assim não duplica nem fica sem banco_referencia).
-- Idempotente: antes de inserir, apaga só as receitas de outubro AINDA pendentes, sem conciliação
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
  and data_vencimento between '2026-10-01' and '2026-10-31';

insert into contas_receber (descricao, cliente, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.cliente, v.valor, '2026-10-05', 'pendente', 'seliga_midia',
       (select id from categorias where nome = v.categoria order by created_at limit 1)
from (values
  -- Seliga Mídia
  ('Setta - Parcela 3/6',            'Setta',                 12666.67, 'Seliga Mídia'),
  ('Caixa',                          'Caixa',                 50000.00, 'Seliga Mídia'),
  -- Girando na Alta
  ('Autonuntes',                     'Autonuntes',            6000.00,  'Girando na Alta'),
  ('Hyundai - de setembro e agosto', 'Hyundai',               3000.00,  'Girando na Alta'),
  ('Tokyo motors (CF motos)',        'Tokyo motors',          3683.31,  'Girando na Alta'),
  ('Segsat',                         'Segsat',                2000.00,  'Girando na Alta'),
  ('Kia',                            'Kia',                   750.00,   'Girando na Alta'),
  ('BYD',                            'BYD',                   2000.00,  'Girando na Alta'),
  ('Bajaj',                          'Bajaj',                 1800.00,  'Girando na Alta'),
  ('Iofer',                          'Iofer',                 550.00,   'Girando na Alta'),
  ('Shopping do automóvel',          'Shopping do automóvel', 5500.00,  'Girando na Alta'),
  ('Omoda',                          'Omoda',                 1800.00,  'Girando na Alta'),
  ('Geely',                          'Geely',                 2000.00,  'Girando na Alta'),
  ('Leap',                           'Leap',                  2000.00,  'Girando na Alta'),
  ('Via sul - Jeep',                 'Via sul',               1800.00,  'Girando na Alta'),
  ('GAC nacional - 15/09',           'GAC nacional',          15000.00, 'Girando na Alta')
) as v(descricao, cliente, valor, categoria);

-- conferência: deve dar 16 linhas e 110549.98
select count(*) as itens, sum(valor) as total
from contas_receber
where origem = 'seliga_midia'
  and coalesce(reembolso, false) = false
  and data_vencimento between '2026-10-01' and '2026-10-31';

commit;
