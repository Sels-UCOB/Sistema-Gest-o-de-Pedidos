# Sistema de Gestão de Pedidos — Sels UCOB

Sistema web para controle de pedidos, separação de materiais, envios e relatórios da Sels UCOB.

---

## Visão Geral da Infraestrutura

```
GitHub (código-fonte)
    ↓  push na branch main
Vercel (hospedagem / deploy automático)
    ↕  requisições em tempo real
Supabase (banco de dados + autenticação)
```

Todo deploy é automático: qualquer commit enviado para a branch `main` no GitHub dispara um novo build e publicação no Vercel em poucos minutos.

---

## 1. Repositório — GitHub

| Item | Valor |
|------|-------|
| URL | https://github.com/Sels-UCOB/Sistema-Gest-o-de-Pedidos |
| Branch principal | `main` |
| Conta GitHub | sels.ucob@adventistas.org |

**Para clonar o projeto localmente:**
```bash
git clone https://github.com/Sels-UCOB/Sistema-Gest-o-de-Pedidos.git
cd Sistema-Gest-o-de-Pedidos
npm install
```

---

## 2. Hospedagem — Vercel

| Item | Valor |
|------|-------|
| Painel | https://vercel.com/dashboard |
| Conta | sels.ucob@adventistas.org |
| Projeto | `sistema-gestao-pedidos` |
| URL do app | _(ver painel do Vercel — domínio gerado automaticamente)_ |

**Como funciona o deploy:**
- Cada `git push origin main` aciona um deploy automático.
- O build usa `next build` com `output: "export"` (site estático).
- Não há servidor Node rodando — é HTML/JS puro servido pelo Vercel CDN.

**Variáveis de ambiente (configuradas no painel do Vercel):**

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase |

> ⚠️ Se precisar atualizar essas variáveis, acesse: Vercel → Projeto → Settings → Environment Variables. Após salvar, faça um redeploy manual (Deployments → botão "Redeploy").

---

## 3. Banco de Dados e Autenticação — Supabase

| Item | Valor |
|------|-------|
| Painel | https://supabase.com/dashboard |
| Conta | sels.ucob@adventistas.org |
| URL do projeto | https://axkfwryoijvcyvhskdnh.supabase.co |

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários do sistema (nome, papel, campo) |
| `orders` | Pedidos criados |
| `shipments` | Envios agrupados |
| `products` | Catálogo de produtos |
| `inventory` | Estoque por depósito |

### Papéis de usuário

| Papel | Acesso |
|-------|--------|
| `admin` | Acesso total — cria pedidos, gerencia usuários, vê todos os campos |
| `operator` | Acesso restrito ao campo vinculado |

### Gerenciar usuários

No próprio sistema (como admin): menu **Usuários** → alterar papel (`admin`/`operator`) e campo.

Via Supabase (para criar ou deletar): painel → Authentication → Users.

---

## 4. Contas e Acessos

> ⚠️ Nunca commitar senhas no repositório. Guarde as credenciais em local seguro (cofre de senhas, cofre físico da organização).

| Serviço | Usuário | Onde guardar a senha |
|---------|---------|----------------------|
| GitHub | sels.ucob@adventistas.org | Cofre da organização |
| Vercel | sels.ucob@adventistas.org | Cofre da organização |
| Supabase | sels.ucob@adventistas.org | Cofre da organização |
| App (admin) | Cadastrado via Supabase Auth | Cofre da organização |

---

## 5. Desenvolvimento Local

**Pré-requisitos:** Node.js 18+, npm

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis locais
# (copie o conteúdo do painel do Supabase → Project Settings → API)
cp .env.local.example .env.local
# edite .env.local com as chaves do Supabase

# Rodar em modo desenvolvimento
npm run dev
# → http://localhost:3000

# Gerar build de produção (apenas para testar)
npm run build
```

**Arquivo `.env.local` necessário:**
```
NEXT_PUBLIC_SUPABASE_URL=https://axkfwryoijvcyvhskdnh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon do painel do Supabase>
```

---

## 6. Estrutura do Projeto

```
app/
  page.tsx                        → Tela de login
  (main)/
    layout.tsx                    → Layout compartilhado (header + nav)
    hub/page.tsx                  → Tela inicial com módulos
    orders/page.tsx               → Gestão de pedidos e separação
    shipments/page.tsx            → Criação e listagem de envios
    reports/page.tsx              → Relatórios e impressão
    products/page.tsx             → Catálogo e controle de estoque
    admin/page.tsx                → Gerenciamento de usuários (só admin)
    fiorino/page.tsx              → Controle do veículo Fiorino
    estoque/page.tsx              → Controle de estoque
    campanhas/
      page.tsx                    → Importação de campanhas
      acertos/page.tsx            → Acertos de campanha
      lancamentos/page.tsx        → Lançamentos
      lancamentos-lideres/        → Lançamentos de líderes
      escalas/page.tsx            → Escalas
      bolsas/page.tsx             → Bolsas
      encerramento/page.tsx       → Encerramento de campanha
      configuracoes/page.tsx      → Configurações de campanha

lib/
  supabase.ts                     → Cliente Supabase
  supabase-db.ts                  → Funções de acesso ao banco
  db.ts                           → Tipos TypeScript das entidades
  campos.ts                       → Mapa de campanhas e depósitos
  user-context.ts                 → Contexto de sessão do usuário
  campanhas/                      → Lógica, tipos e DB do módulo campanhas
```

---

## 7. Fluxo de Trabalho (para referência operacional)

```
1. Criar pedido (aba Criar em Pedidos)
      ↓ selecionar campanha, depósito, cliente, itens
2. Separar pedido (aba Gerenciar → botão Separar)
      ↓ marcar cada item + foto → foto da caixa embalada → pedido fechado
3. Criar envio (Envios → Novo)
      ↓ selecionar pedidos fechados, definir transportadora ou retirada
4. Anexar comprovante (Envios → Lista → Comprovantes)
5. Consultar relatório (Relatórios)
      ↓ filtrar por data, campo, responsável → imprimir
```

---

## 8. Problemas Comuns

**Login não funciona após muito tempo parado**
→ A sessão expira. Basta fazer login novamente. O sistema detecta inatividade de 2+ minutos e verifica a sessão automaticamente ao retornar.

**Foto não salva**
→ Verifique conexão com internet. O app exibe alerta se o banco retornar erro.

**Produto não encontrado na criação do pedido**
→ O produto pode não estar cadastrado no catálogo. Acesse Catálogo → adicione o produto e defina o estoque.

**Deploy no Vercel com variáveis vazias**
→ Nunca use o terminal para adicionar variáveis via `vercel env add` (risco de corrupção de encoding). Sempre use o painel web: Vercel → Settings → Environment Variables.

---

## 9. Tecnologias Utilizadas

| Tecnologia | Versão | Finalidade |
|-----------|--------|------------|
| Next.js | 16 | Framework React com export estático |
| React | 19 | Interface |
| Supabase | 2.x | Banco de dados (PostgreSQL) + Auth |
| Tailwind CSS | 4 | Estilização |
| shadcn/ui | — | Componentes de interface |
| date-fns | 4 | Formatação de datas |
| @e965/xlsx | — | Importação de planilhas XLS |
| @react-pdf/renderer | — | Geração de PDF no client |

---

*Sels UCOB © 2025*
