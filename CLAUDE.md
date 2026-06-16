---
name: sistema-gestao-pedidos
description: >
  Guia de desenvolvimento para o Sistema de Gestão de Pedidos da Sels UCOB.
  Use esta skill SEMPRE que for criar, editar ou revisar qualquer código deste
  projeto — componentes, páginas, queries ao banco, migrações, hooks, ou
  qualquer alteração destinada ao repositório. Use também para decidir onde
  implementar uma funcionalidade nova quando a tarefa for vaga.
---

# Sistema de Gestão de Pedidos — Guia Operacional

## Stack
- Next.js 16 (App Router, `output: "export"` — **site estático**, sem servidor Node)
- React 19 + TypeScript
- Supabase 2.x (PostgreSQL + Auth)
- Tailwind CSS 4 + shadcn/ui + @base-ui/react
- `@react-pdf/renderer` — geração de PDF no client
- `@e965/xlsx` — importação de planilhas XLS
- `date-fns` 4 — formatação de datas
- Node.js 18+ requerido localmente

> ⚠️ O build gera HTML/JS estático. Não usar APIs de servidor (Route Handlers,
> Server Actions) — tudo é client-side via Supabase diretamente.

---

## Antes de qualquer alteração

1. Verificar branch atual: `git branch`
2. Se estiver em `main`, criar branch antes de qualquer mudança:
   ```
   git checkout -b feat/<nome-descritivo>
   ```
3. Nunca commitar ou fazer push direto na `main`.
4. Para sincronizar: `git fetch origin && git pull origin main`

> ⚠️ Qualquer push na `main` aciona deploy automático no Vercel. Código quebrado
> vai para produção imediatamente.

---

## Estrutura de arquivos

| Caminho | Conteúdo |
|---|---|
| `app/page.tsx` | Tela de login |
| `app/(main)/layout.tsx` | Layout compartilhado (sidebar + nav mobile) |
| `app/(main)/orders/` | Gestão de pedidos e separação |
| `app/(main)/shipments/` | Criação e listagem de envios |
| `app/(main)/reports/` | Relatórios e impressão |
| `app/(main)/products/` | Catálogo e estoque por depósito |
| `app/(main)/estoque/` | Contagem de inventário físico (sessões colaborativas) |
| `app/(main)/fiorino/` | Planejamento de carregamento do Fiorino |
| `app/(main)/admin/` | Gerenciamento de usuários e campanhas (só `admin`) |
| `app/(main)/campanhas/` | Módulo de campanhas: acertos, lançamentos, escalas, bolsas |
| `components/ui/` | Componentes shadcn/ui |
| `hooks/` | Hooks customizados |
| `lib/supabase.ts` | Cliente Supabase (instância única) |
| `lib/supabase-db.ts` | **Todas as queries ao banco ficam aqui** |
| `lib/db.ts` | Tipos TypeScript das entidades principais |
| `lib/campos.ts` | Depósitos (`WAREHOUSES`, `WarehouseId`) — campanhas estão no banco |
| `lib/user-context.ts` | Contexto de sessão do usuário |
| `lib/campanhas/` | Lógica, tipos e DB do módulo de campanhas |
| `supabase/migrations/` | Migrações do banco (schema completo versionado) |

---

## Banco de dados

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários (nome, papel, campo) |
| `orders` | Pedidos |
| `shipments` | Envios agrupados |
| `products` | Catálogo de produtos |
| `inventory` | Estoque por depósito (chave composta: product_id + warehouse_id) |
| `fiorino_plans` | Planos de carregamento do Fiorino (máx 5) |
| `inventory_sessions` | Sessões de contagem de inventário físico |
| `inventory_counts` | Registros individuais por item em cada sessão |
| `config_global` | Configuração compartilhada — tipos, campos, líderes, **campanhas** |
| `acertos` | Acertos de campanha por campo |
| `acerto_state` | Estado salvo de cada acerto |
| `acerto_lancamentos` | Lançamentos financeiros por acerto |
| `acerto_lider` | Dados do líder por acerto |
| `acerto_debitos` | Débitos por acerto |
| `acerto_bolsas` | Dados de bolsas identificadas |
| `acerto_anexos` | Anexos XLSX por acerto (soft-delete via `deleted_at`) |

### Papéis de usuário

| Papel | Acesso |
|---|---|
| `admin` | Total — todos os campos, gerencia usuários |
| `operator` | Restrito ao campo vinculado no perfil |

### Regras de acesso ao banco

- **Todo acesso ao banco passa por `lib/supabase-db.ts`** — nunca criar queries
  inline em componentes ou páginas.
- O cliente Supabase vem de `lib/supabase.ts`.
- Controle de acesso usa `ProfileRow` de `lib/db.ts` — verificar o papel e
  campo do usuário antes de qualquer operação sensível.
- Sessão do usuário disponível via `lib/user-context.ts`.
- RLS usa as funções SQL `is_admin()` e `my_campo()` (SECURITY DEFINER) para
  evitar recursão ao consultar `profiles` dentro de policies.
- **Campanhas** vêm do banco (`config_global.campanhas`) via `getCampanhas()` —
  não são mais hardcoded. Nunca usar `CAMPO_MAP` de `lib/campos.ts` para campanhas.
- Alterações em `config_global` devem usar `.update().eq("id", 1)` — nunca
  `.upsert()`, pois a policy RLS não tem INSERT.

---

## Variáveis de ambiente

Arquivo `.env.local` (nunca commitar):

```
NEXT_PUBLIC_SUPABASE_URL=https://axkfwryoijvcyvhskdnh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon do painel do Supabase>
```

> No Vercel, variáveis são configuradas pelo painel web (Settings → Environment
> Variables). Nunca usar `vercel env add` no terminal — risco de encoding corrompido.

---

## Padrões de código

- Sem comentários explicativos — o código deve ser autoexplicativo.
- Não criar utilitários, hooks ou abstrações além do necessário para a tarefa.
- Componentes novos vão em `components/ui/` (shadcn) ou numa subpasta por módulo.
- Novos hooks vão em `hooks/`.
- Alterações no banco exigem migration em `supabase/migrations/`.

---

## Antes de subir o código

1. Confirmar que está numa branch de feature (não `main`).
2. Rodar build/typecheck:
   ```
   npm run build
   # ou apenas checagem de tipos:
   npx tsc --noEmit
   ```
3. Abrir PR apontando para `main` — nunca push direto.