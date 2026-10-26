-- DRE: classifica pró-labore e Salário Pedro na categoria "Salários e Pró-labore" (custo fixo).
-- Antes essas contas ficavam sem categoria e se misturavam em "Sem categoria" na DRE.
-- Idempotente: só mexe nas que ainda estão sem categoria.
insert into categorias (nome, tipo, tipo_custo)
select 'Salários e Pró-labore', 'pagar', 'fixo'
where not exists (select 1 from categorias where nome = 'Salários e Pró-labore');

update categorias set tipo_custo = 'fixo' where nome = 'Salários e Pró-labore';

update contas_pagar
   set categoria_id = (select id from categorias where nome = 'Salários e Pró-labore' order by created_at limit 1)
 where categoria_id is null
   and (descricao like 'Pró-labore - %' or descricao = 'Salário Pedro');

-- conferência: outubro deve listar os 3 pró-labores (18.250,00) + Salário Pedro (2.500,00) = 20.750,00
select descricao, valor, data_pagamento, status
from contas_pagar c join categorias cat on cat.id = c.categoria_id
where cat.nome = 'Salários e Pró-labore' and c.data_vencimento between '2026-10-01' and '2026-10-31'
order by c.valor desc;
