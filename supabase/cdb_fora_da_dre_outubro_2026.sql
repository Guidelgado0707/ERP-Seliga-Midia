-- DRE: aplicação em CDB não é despesa, é dinheiro que continua em caixa (vai pra reserva).
-- Na Conciliação, 3 saídas "APLICAÇÃO DE CDB" de outubro foram registradas como avulso na categoria
-- "Outros" (R$ 20.000 + 2.000 + 1.000 = R$ 23.000) e entravam como despesa paga na DRE.
-- Remove essas contas e guarda a referência do extrato em banco_ignorados, pra a Conciliação não
-- trazer os lançamentos de volta. O padrão do sistema pra reserva/investimento é o bloco
-- "Destinação do resultado" da DRE (tabela destinacao_resultado), não uma conta a pagar.
-- Idempotente: se já rodou, não acha mais nada pra apagar.
with alvo as (
  select c.id, c.banco_referencia, c.descricao, c.valor, c.data_pagamento
  from contas_pagar c
  join categorias cat on cat.id = c.categoria_id
  where cat.nome = 'Outros'
    and c.origem = 'seliga_midia'
    and c.status = 'pago'
    and c.descricao = 'APLICAÇÃO DE CDB'
    and c.banco_referencia is not null
    and c.data_pagamento between '2026-10-01' and '2026-10-31'
), ins as (
  insert into banco_ignorados (banco_referencia, descricao, valor, data)
  select banco_referencia, descricao, valor, data_pagamento from alvo
  on conflict (banco_referencia) do nothing
  returning 1
)
delete from contas_pagar where id in (select id from alvo);

-- conferência: 3 CDBs ignorados (23000.00) e categoria Outros de outubro sem nenhum CDB
select count(*) as cdb_ignorados, sum(valor) as total
from banco_ignorados where descricao = 'APLICAÇÃO DE CDB' and data between '2026-10-01' and '2026-10-31';
