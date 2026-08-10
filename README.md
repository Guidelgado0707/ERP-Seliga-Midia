# Gestão Seliga Mídia

Sistema de gestão financeira: contas a pagar, contas a receber, controle de notas fiscais
pelo celular e distribuição de dividendos entre sócios.

Stack: **Next.js** (site) + **Supabase** (banco de dados, login e armazenamento de arquivos) + **Vercel** (hospedagem).
Você não precisa gerenciar nenhum servidor — tudo isso é feito por essas duas plataformas.

---

## Passo 1 — Criar o projeto no Supabase (banco de dados + login)

1. Acesse **https://supabase.com**, crie uma conta gratuita e clique em **"New project"**.
2. Escolha um nome (ex: `agencia-erp`), uma senha forte pro banco (guarde em um cofre de senhas) e a região `South America (São Paulo)`.
3. Espere o projeto ser criado (~2 min).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**.
   Isso cria todas as tabelas (contas a pagar, a receber, sócios, dividendos, notas fiscais) já com segurança configurada (RLS).
6. Vá em **Authentication → Users → Add user** e crie o seu usuário (e-mail + senha). É com ele que você vai logar no sistema.
7. Vá em **Project Settings → API**. Você vai precisar de dois valores nos próximos passos:
   - **Project URL**
   - **anon public key**

## Passo 2 — Rodar localmente (opcional, mas recomendado pra testar antes de publicar)

Requer o [Node.js](https://nodejs.org) instalado (versão 18 ou superior).

```bash
cd agencia-erp
cp .env.example .env.local
# edite o .env.local e cole a Project URL e a anon key do Passo 1
npm install
npm run dev
```

Abra `http://localhost:3000` e faça login com o usuário criado no Passo 1.

## Passo 3 — Publicar no ar com a Vercel

1. Crie uma conta gratuita em **https://vercel.com** (pode entrar com GitHub).
2. Suba esta pasta pra um repositório no seu GitHub (crie um repositório novo, ex: `agencia-erp`, e faça upload dos arquivos — ou use `git push` se souber usar).
3. Na Vercel, clique em **"Add New" → "Project"** e selecione esse repositório.
4. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = a Project URL do Passo 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a anon key do Passo 1
5. Clique em **Deploy**. Em 1-2 minutos seu sistema estará no ar, com HTTPS automático, em um endereço tipo `agencia-erp.vercel.app`.
6. (Opcional) Em **Project Settings → Domains**, você pode apontar um domínio próprio (ex: `financeiro.suaagencia.com.br`).

Pronto — isso já é "produção": HTTPS, backup automático do banco pelo Supabase, e senha protegida.

## Passo 4 — Usando o sistema

- **Dashboard**: visão geral de faturamento do mês, despesas, saldo e próximos vencimentos.
- **Contas a Pagar / a Receber**: cadastre, marque como pago/recebido, e exporte em **CSV** (botão no topo) —
  esse CSV é o arquivo que você manda pro seu contador todo fim de mês.
- **Notas**: no celular, abra o site (funciona como um app, pode até "adicionar à tela inicial" no navegador),
  toque em "Fotografar / anexar nota" e a foto já fica salva. Depois é só tocar em "Categorizar" pra
  preencher valor e descrição.
- **Sócios**: cadastre os sócios com o percentual de participação de cada um, depois em "Nova distribuição"
  informe o mês e o lucro a distribuir — o sistema calcula automaticamente o valor de cada sócio.

## Segurança — o que já está feito e o que considerar

- Login obrigatório (ninguém acessa sem senha) e sessão protegida via `middleware.ts`.
- Todas as tabelas têm **Row Level Security** ativada no Supabase — só usuários autenticados acessam os dados.
- Fotos de notas fiscais ficam em um bucket **privado** (não são públicas na internet); o app gera links temporários de 1h pra exibi-las.
- HTTPS automático via Vercel.
- Recomendo ativar a **autenticação em duas etapas (2FA)** na sua própria conta do Supabase e da Vercel
  (isso protege o painel de administração, não o login do ERP em si).
- Faça backups periódicos: Supabase free tier mantém backups por tempo limitado — se quiser mais tranquilidade,
  o plano pago (~US$25/mês) tem backup diário de 7 dias.

## Roteiro sugerido pra evoluir (sem pressa, como você pediu)

1. **Agora**: testar o fluxo de contas a pagar/receber e exportação pro contador.
2. **Próximo passo**: adicionar os sócios e testar a distribuição de dividendos com números reais de agosto.
3. **Depois**: dar acesso aos sócios (login próprio, permissões — hoje o sistema já está pronto pra isso a nível de banco,
   falta só a tela de convite de usuário).
4. **Mais pra frente**: leitura automática do valor da nota fiscal por foto (OCR/IA) — hoje você digita o valor manualmente
   ao categorizar, mas dá pra automatizar depois usando a própria API da Anthropic.
5. **Ano que vem**: com a mudança pro Simples Híbrido, o campo "gera crédito tributário" em Contas a Receber já
   fica registrado por lançamento — vale conversar com seu contador sobre quais relatórios adicionais ele vai
   precisar tirar daí.

---

Qualquer dúvida durante a configuração, volte na conversa com o Claude com o erro exato que aparecer — é mais fácil de resolver com a mensagem de erro em mãos.
