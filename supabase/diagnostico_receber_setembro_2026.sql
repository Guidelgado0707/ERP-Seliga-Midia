-- DIAGNÓSTICO A Receber setembro/2026 — descobrir por que o card mostra 103.066,67
-- em vez de 112.429,17. Roda tudo e me manda os 4 resultados.

-- 1) Reproduz EXATAMENTE o card "Provisionado do mês" (origem seliga_midia,
--    não reembolso, não cancelado, vencimento em setembro). Deve dar 103.066,67.
select count(*) as qtd, coalesce(sum(valor),0) as total_card
from contas_receber
where origem = 'seliga_midia'
  and reembolso = false
  and status <> 'cancelado'
  and data_vencimento between '2026-09-01' and '2026-09-30';

-- 2) Lista linha a linha o que o card ENXERGA (compara com a tabela de 22 itens)
select data_vencimento, descricao, cliente, valor, status
from contas_receber
where origem = 'seliga_midia'
  and reembolso = false
  and status <> 'cancelado'
  and data_vencimento between '2026-09-01' and '2026-09-30'
order by valor desc;

-- 3) Linhas de setembro que o card NÃO conta e por quê (origem/reembolso/cancelado)
select data_vencimento, descricao, valor, origem, reembolso, status,
  case
    when origem <> 'seliga_midia' then 'origem != seliga_midia'
    when reembolso then 'reembolso = true'
    when status = 'cancelado'  then 'cancelado'
    else '?'
  end as motivo
from contas_receber
where data_vencimento between '2026-09-01' and '2026-09-30'
  and (origem <> 'seliga_midia' or reembolso = true or status = 'cancelado')
order by valor desc;

-- 4) Procura os mesmos clientes com vencimento FORA de setembro (data digitada errada?)
select data_vencimento, descricao, valor, origem, status
from contas_receber
where (data_vencimento < '2026-09-01' or data_vencimento > '2026-09-30')
  and descricao ilike any (array[
    '%setta%','%caixa%','%festival%','%hyundai%','%byd%','%omoda%','%geely%',
    '%leap%','%leeap%','%kia%','%bajaj%','%iofer%','%shopping%','%fronte%',
    '%via sul%','%autoline%','%segsat%','%autonu%','%granvia%','%jeep%'
  ])
order by data_vencimento;
