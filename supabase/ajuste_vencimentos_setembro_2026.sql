-- Ajuste de vencimentos de setembro/2026 (Seliga Mídia):
--   • Tudo em A RECEBER (setembro, seliga_midia, não-reembolso) → 2026-09-30
--   • Simples Nacional, Contador e INSS → 2026-09-20
--   • Salário Pedro → 2026-09-30
-- Só mexe em linhas PENDENTES (não altera as que já foram pagas/recebidas).
begin;

-- A RECEBER: tudo pra dia 30
update contas_receber
set data_vencimento = '2026-09-30'
where origem = 'seliga_midia'
  and coalesce(reembolso, false) = false
  and status = 'pendente'
  and data_vencimento between '2026-09-01' and '2026-09-30';

-- A PAGAR (impostos e contador) → dia 20
update contas_pagar
set data_vencimento = '2026-09-20'
where origem = 'seliga_midia'
  and status = 'pendente'
  and data_vencimento between '2026-09-01' and '2026-09-30'
  and descricao in ('Simples Nacional', 'Contador', 'INSS');

-- A PAGAR (salário Pedro) → dia 30
update contas_pagar
set data_vencimento = '2026-09-30'
where origem = 'seliga_midia'
  and status = 'pendente'
  and data_vencimento between '2026-09-01' and '2026-09-30'
  and descricao = 'Salário Pedro';

commit;
