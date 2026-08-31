-- Registra a reserva/destinação de agosto/2026: R$ 11.912,00.
-- Só afeta o bloco "Destinação do resultado" da DRE. NÃO toca o Painel
-- (nem Caixa, nem Reserva de Emergência) — tabela isolada. Idempotente.
begin;

insert into destinacao_resultado (mes, reserva, observacoes)
values ('2026-08', 11912.00, 'Guardado pro caixa em agosto')
on conflict (mes) do update
  set reserva = excluded.reserva,
      observacoes = excluded.observacoes,
      updated_at = now();

commit;
