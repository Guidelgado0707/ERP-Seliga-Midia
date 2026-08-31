-- Remove o resíduo "Receita Projeto JC - agosto" de R$ 25.158,00 — era só o
-- LUCRO lançado por engano. O modelo correto é receita total do JC = 71.500
-- (bruto) e os custos abatidos à parte. Seguro: mira só essa linha exata;
-- se já não existir, apaga 0 linhas (sem efeito).
begin;

delete from contas_receber
where origem = 'projeto_jc'
  and valor = 25158.00
  and descricao = 'Receita Projeto JC - agosto';

commit;
