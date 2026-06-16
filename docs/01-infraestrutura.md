# Infraestrutura — Contas, Acesso e Ambiente

## Visão geral

```
GitHub (código-fonte)
    ↓  push na branch main
Vercel (hospedagem / build automático)
    ↕  requisições em tempo real
Supabase (banco de dados + autenticação + storage)
```

O sistema é um **site estático** (HTML + JS puro). Não existe servidor Node rodando em produção — tudo é processado no navegador do usuário, que se comunica diretamente com o Supabase.

---

## 1. GitHub

| Item | Valor |
|------|-------|
| URL do repositório | https://github.com/Sels-UCOB/Sistema-Gest-o-de-Pedidos |
| Conta | sels.ucob@adventistas.org |
| Branch principal | `main` |

### Regras de ouro
- **Nunca commitar direto na `main`** — qualquer push na main aciona deploy automático no Vercel imediatamente.
- Sempre criar uma branch de feature: `git checkout -b feat/nome-da-mudanca`
- Abrir Pull Request apontando para `main` e aguardar revisão antes de mergear.

### Clonar o projeto localmente
```bash
git clone https://github.com/Sels-UCOB/Sistema-Gest-o-de-Pedidos.git
cd Sistema-Gest-o-de-Pedidos
npm install
```

---

## 2. Vercel

| Item | Valor |
|------|-------|
| Painel | https://vercel.com/dashboard |
| Conta | sels.ucob@adventistas.org |
| Projeto | `sistema-gestao-pedidos` |

### Como o deploy funciona
1. Desenvolvedor faz merge de um PR na `main` no GitHub
2. Vercel detecta o push automaticamente
3. Executa `next build` (gera HTML/JS estático)
4. Publica os arquivos no CDN — em ~2 minutos o app em produção está atualizado

### Variáveis de ambiente
Nunca adicionar pelo terminal (`vercel env add` corrompe encoding). Sempre usar o painel:

**Vercel → Projeto → Settings → Environment Variables**

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon key) do Supabase |

Após alterar variáveis: **Deployments → botão "Redeploy"** para o novo valor entrar em vigor.

---

## 3. Supabase

| Item | Valor |
|------|-------|
| Painel | https://supabase.com/dashboard |
| Conta | sels.ucob@adventistas.org |
| URL do projeto | https://axkfwryoijvcyvhskdnh.supabase.co |

### O que fica no Supabase
- **PostgreSQL** — banco de dados com todas as tabelas do sistema
- **Auth** — login/senha dos usuários (email + password)
- **Storage** — fotos de itens separados, comprovantes de envio, anexos XLSX

### Acessar as tabelas
Painel → **Table Editor** → selecionar a tabela

### Acessar os usuários do sistema
Painel → **Authentication → Users**

Para criar um usuário: botão **"Add user"** → preencher e-mail e senha.
Para deletar: selecionar o usuário → botão de exclusão.

> Após criar o usuário no Supabase, é necessário acessar o sistema como admin e definir o **papel** (admin/operator) e o **campo** (GO/MT/MS) em **Administração → Usuários**.

### Executar SQL manualmente
Painel → **SQL Editor** → escrever e executar a query

Usado para: corrigir dados, rodar migrations, consultas de diagnóstico.

### Storage — buckets existentes
| Bucket | Conteúdo |
|--------|----------|
| `order-photos` | Fotos de separação de itens e caixas embaladas |
| `acerto-anexos` | Arquivos XLSX de escala por acerto |

---

## 4. Ambiente local de desenvolvimento

### Pré-requisitos
- Node.js 18 ou superior
- npm

### Configurar o arquivo de variáveis
Crie o arquivo `.env.local` na raiz do projeto (nunca commitar este arquivo):

```
NEXT_PUBLIC_SUPABASE_URL=https://axkfwryoijvcyvhskdnh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon — copiar do painel Supabase → Settings → API>
```

### Comandos do dia a dia
```bash
# Rodar em modo desenvolvimento (hot reload)
npm run dev
# → abre em http://localhost:3000

# Checar erros de TypeScript sem gerar build
npx tsc --noEmit

# Gerar build de produção (para testar antes de subir)
npm run build
```

### Fluxo de trabalho padrão
```bash
# 1. Garantir que está na main atualizada
git checkout main
git pull origin main

# 2. Criar branch para a mudança
git checkout -b feat/nome-descritivo

# 3. Fazer as alterações...

# 4. Verificar tipos
npx tsc --noEmit

# 5. Commitar e enviar
git add <arquivos>
git commit -m "feat: descrição da mudança"
git push -u origin feat/nome-descritivo

# 6. Abrir Pull Request no GitHub apontando para main
```

---

## 5. Estrutura de papéis e campos

O sistema divide os usuários em **papéis** e **campos**:

| Papel | O que pode fazer |
|-------|-----------------|
| `admin` | Tudo — vê todos os campos, gerencia usuários e campanhas |
| `operator` | Restrito ao campo vinculado — vê só seus pedidos, estoque e campanhas |

| Campo | Região |
|-------|--------|
| `GO` | Sede (Goiânia) |
| `MT` | Mato Grosso |
| `MS` | Mato Grosso do Sul |

O campo de um operador define quais campanhas aparecem na criação de pedidos e quais depósitos de estoque ele enxerga.
