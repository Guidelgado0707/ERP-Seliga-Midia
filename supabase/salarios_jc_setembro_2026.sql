-- SALÁRIOS JC — setembro/2026 (equipe que trabalha com a gente).
-- Todos como custo do projeto JC (origem projeto_jc), PENDENTES.
--   Jammily  3.000,00
--   Bia      2.500,00
--   Zig      6.500,00  (inclui os 2.000 do projeto Seliga I.A. — tudo em JC)
--   Marcelly 2.500,00
--   Total   14.500,00
-- Categoria 'Salários'. Pagamento real é dia 01 e 15 (metade em cada), mas lançamos
-- uma linha única por pessoa com vencimento 2026-09-30 — quando pagar tudo, marca ok.
-- Idempotente: insere só o que ainda não existe.
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Salários', 'pagar', 'fixo'
where not exists (select 1 from categorias where nome = 'Salários');

insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.valor, '2026-09-30', 'pendente', 'projeto_jc',
       (select id from categorias where nome = 'Salários' order by created_at limit 1)
from (values
  ('Salário Jammily (JC)',  3000.00),
  ('Salário Bia (JC)',      2500.00),
  ('Salário Zig (JC)',      6500.00),
  ('Salário Marcelly (JC)', 2500.00)
) as v(descricao, valor)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao and c.origem = 'projeto_jc' and c.data_vencimento = '2026-09-30'
);

commit;
