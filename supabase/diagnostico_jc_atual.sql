-- DIAGNÓSTICO: estado atual de TODAS as receitas de JC em 2026 (qualquer status).
-- Serve pra confirmar o contrato (71.500/mês) e achar o resíduo "Projeto JC - agosto"
-- de R$ 25.158 (se ainda existir). Só leitura.

select data_vencimento, data_recebimento, descricao, cliente, valor, status
from contas_receber
where origem = 'projeto_jc'
  and (
    (data_vencimento  >= '2026-01-01' and data_vencimento  <= '2026-12-31')
    or (data_recebimento >= '2026-01-01' and data_recebimento <= '2026-12-31')
  )
order by coalesce(data_recebimento, data_vencimento);
