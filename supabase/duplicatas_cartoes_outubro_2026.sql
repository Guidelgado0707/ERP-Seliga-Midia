-- CONTAS A PAGAR — Outubro/2026: desfaz 2 duplicatas de cartão que inflavam a DRE.
--
-- A) Fatura Itaú (cartão azul): o pagamento de R$ 18.388,83 (09/10) foi registrado como avulso
--    "ITAU UNIBANCO HOLDING S.A." na categoria Outros, mas a fatura já está lançada e paga em 15
--    itens (Seliga R$ 9.270,75 + JC R$ 9.118,08). Dobrava a despesa e jogava a parte do JC na
--    Seliga. Aqui: apaga o avulso e guarda a referência do banco em banco_ignorados (um pagamento
--    do banco paga vários itens, então não dá pra vincular a uma linha só). Os 15 itens ficam como
--    estão (já pagos).
--
-- B) Fatura C6: o pagamento "PGTO FAT CARTAO C6" R$ 4.352,25 (01/10) é a fatura que a planilha
--    mostrava como paga (R$ 4.325,25, dígitos trocados). A conta "Cartão C6" R$ 4.325,25 (venc.
--    30/10, marcada paga em 20/10 na tela, sem vínculo com o banco) duplicava a despesa. Aqui:
--    apaga o avulso e acerta a conta: valor real (R$ 4.352,25), data do banco (01/10) e a
--    referência do banco.
--
-- Tudo numa transação: se qualquer conferência falhar (linha não encontrada, soma diferente),
-- aborta e não altera nada.
do $$
declare
  v_itau uuid; v_ref_itau text; v_n int; v_soma numeric;
  v_c6_avulso uuid; v_c6_pend uuid;
  v_ref text; v_data date; v_em timestamptz;
begin
  -- ---------- A) fatura Itaú ----------
  select id, banco_referencia into strict v_itau, v_ref_itau from contas_pagar
   where origem = 'seliga_midia' and status = 'pago'
     and descricao = 'ITAU UNIBANCO HOLDING S.A.' and valor = 18388.83
     and data_pagamento = '2026-10-09' and banco_referencia is not null;

  -- confere que a fatura já está lançada e paga por itens (senão apagar o avulso some com a despesa)
  select count(*), coalesce(sum(valor), 0) into v_n, v_soma from contas_pagar
   where descricao like 'Cartão azul%' and data_vencimento = '2026-10-10'
     and status = 'pago' and banco_referencia is null;
  if v_n <> 15 or v_soma <> 18388.83 then
    raise exception 'Itens pagos do cartão azul não batem (achei % linhas somando R$ %, esperado 15 / 18388.83)', v_n, v_soma;
  end if;

  delete from contas_pagar where id = v_itau;

  insert into banco_ignorados (banco_referencia, descricao, valor, data)
  values (v_ref_itau, 'ITAU UNIBANCO HOLDING S.A. (fatura cartão azul)', 18388.83, '2026-10-09')
  on conflict (banco_referencia) do nothing;

  -- ---------- B) fatura C6 ----------
  select id into strict v_c6_avulso from contas_pagar
   where origem = 'seliga_midia' and status = 'pago'
     and descricao = 'PGTO FAT CARTAO C6' and valor = 4352.25
     and data_pagamento = '2026-10-01' and banco_referencia is not null;

  -- a conta "Cartão C6" da planilha já foi marcada como paga na tela (sem vínculo com o banco)
  select id into strict v_c6_pend from contas_pagar
   where origem = 'seliga_midia' and status = 'pago' and banco_referencia is null
     and descricao = 'Cartão C6' and valor = 4325.25 and data_vencimento = '2026-10-30';

  select banco_referencia, data_pagamento, pago_em into v_ref, v_data, v_em
    from contas_pagar where id = v_c6_avulso;

  delete from contas_pagar where id = v_c6_avulso;

  update contas_pagar
     set valor = 4352.25, status = 'pago',
         data_pagamento = v_data, pago_em = v_em, banco_referencia = v_ref,
         observacoes = 'Pago em 01/10 (R$ 4.352,25). Planilha previa R$ 4.325,25.'
   where id = v_c6_pend;
end $$;

-- conferência: avulso Itaú some (0 linhas) e Cartão C6 = 1 pago (4352.25)
select 'avulso Itaú (deve ser 0)' as item, count(*) as itens, coalesce(sum(valor), 0) as total
from contas_pagar where descricao = 'ITAU UNIBANCO HOLDING S.A.' and data_pagamento = '2026-10-09'
union all
select 'Cartão C6', count(*), sum(valor)
from contas_pagar where descricao = 'Cartão C6' and status = 'pago' and data_pagamento = '2026-10-01';
