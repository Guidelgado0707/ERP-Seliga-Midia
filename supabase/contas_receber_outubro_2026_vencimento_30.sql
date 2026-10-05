-- CONTAS A RECEBER — Outubro/2026: move o vencimento das receitas ainda pendentes pra 30/10.
-- Só mexe nas pendentes (Caixa e Autonuntes já foram recebidas e ficam como estão).
update contas_receber
   set data_vencimento = '2026-10-30'
 where origem = 'seliga_midia'
   and coalesce(reembolso, false) = false
   and status = 'pendente'
   and data_vencimento between '2026-10-01' and '2026-10-31';

-- conferência: deve dar 14 pendentes (R$ 54.549,98) com vencimento 2026-10-30
select count(*) as itens, sum(valor) as total, min(data_vencimento) as de, max(data_vencimento) as ate
from contas_receber
where origem = 'seliga_midia' and coalesce(reembolso, false) = false
  and status = 'pendente'
  and data_vencimento between '2026-10-01' and '2026-10-31';
