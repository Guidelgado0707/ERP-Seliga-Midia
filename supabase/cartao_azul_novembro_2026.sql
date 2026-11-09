-- CARTÃO AZUL (Itaú) novembro/2026 — fatura fechada em 02/11. Total R$ 17.581,62.
--   JC     = R$ 9.315,78 (Claude, ChatGPT, X, outras ferramentas [Higgsfield, ElevenLabs, Supabase,
--            Vercel, OpenArt], IOF, Uber [inclui Uber One], Hostinger à vista, Z-API, parcelas Lauth e Coris)
--   Seliga = R$ 8.265,84, agrupado por tipo:
--            Viagem 2.303,23 + Compras/Equipamentos 1.655,49 + Alimentação 4.167,79 + Outros 139,33
-- Mesma divisão de outubro. Tudo PENDENTE, vencimento 2026-11-10. Idempotente: apaga só as linhas
-- 'Cartão azul%' deste vencimento que ainda estão pendentes e sem conciliação, e reinsere limpo.
-- Lembrete: o débito da fatura no banco ("ITAU UNIBANCO HOLDING S.A.") deve ser IGNORADO na
-- Conciliação, não registrado, senão duplica a despesa.
begin;

insert into categorias (nome, tipo, tipo_custo) select 'Viagem', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Viagem');
insert into categorias (nome, tipo, tipo_custo) select 'Compras/Equipamentos', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Compras/Equipamentos');
insert into categorias (nome, tipo, tipo_custo) select 'Alimentação', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Alimentação');
insert into categorias (nome, tipo, tipo_custo) select 'Outros', 'pagar', 'variavel' where not exists (select 1 from categorias where nome = 'Outros');

delete from contas_pagar
where descricao like 'Cartão azul%'
  and data_vencimento = '2026-11-10'
  and status = 'pendente'
  and banco_referencia is null;

-- ---------- JC (origem projeto_jc) ----------
insert into contas_pagar (descricao, valor, data_vencimento, status, origem)
values
  ('Cartão azul - Claude (JC)',               3338.36, '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - ChatGPT (JC)',              1875.40, '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - X (JC)',                    59.71,   '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Outras ferramentas (JC)',   1074.41, '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - IOF internacional (JC)',    222.18,  '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Uber (JC)',                 1453.16, '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Hostinger (JC)',            196.99,  '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Z-API (JC)',                99.99,   '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Lauth/Vindi parcelas (JC)', 602.45,  '2026-11-10', 'pendente', 'projeto_jc'),
  ('Cartão azul - Coris parcela (JC)',        393.13,  '2026-11-10', 'pendente', 'projeto_jc');

-- ---------- Seliga (origem seliga_midia), categorizado ----------
insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
values
  ('Cartão azul - Viagem', 2303.23, '2026-11-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Viagem' order by created_at limit 1)),
  ('Cartão azul - Compras/Equipamentos', 1655.49, '2026-11-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Compras/Equipamentos' order by created_at limit 1)),
  ('Cartão azul - Alimentação', 4167.79, '2026-11-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Alimentação' order by created_at limit 1)),
  ('Cartão azul - Outros', 139.33, '2026-11-10', 'pendente', 'seliga_midia',
   (select id from categorias where nome = 'Outros' order by created_at limit 1));

-- conferência: JC 9315.78 (10 itens) | Seliga 8265.84 (4 itens) | total 17581.62
select origem, count(*) as itens, sum(valor) as total
from contas_pagar
where descricao like 'Cartão azul%' and data_vencimento = '2026-11-10'
group by origem
union all
select 'TOTAL', count(*), sum(valor)
from contas_pagar
where descricao like 'Cartão azul%' and data_vencimento = '2026-11-10';

commit;
