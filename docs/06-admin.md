# Administração do Sistema

Acessível apenas para usuários com papel `admin`.

**Rota:** `/admin`

---

## 1. Gerenciar usuários

### Criar um novo usuário
1. Acessar o painel do **Supabase → Authentication → Users**
2. Clicar em **Add user** → informar e-mail e senha
3. Após criar, voltar ao sistema em `/admin`
4. Localizar o usuário na lista → definir:
   - **Perfil:** `Administrador` ou `Operador`
   - **Campo:** `GO`, `MT`, `MS` (apenas para operadores — admin não precisa de campo)

> Operadores sem campo definido veem todas as campanhas e depósitos (comportamento de admin). Sempre definir o campo para restringir o acesso.

### Alterar papel ou campo de um usuário existente
Em `/admin → Usuários`, localizar o usuário e alterar os selects diretamente. A alteração é salva imediatamente.

### Remover um usuário
Pelo painel do **Supabase → Authentication → Users** → selecionar o usuário → excluir.

---

## 2. Gerenciar campanhas

**Rota:** `/admin` → card **Campanhas**

As campanhas disponíveis para criação de pedidos são gerenciadas aqui — **não requerem deploy**.

### Adicionar campanha
1. Digitar o código da campanha (ex: `ALM SA - 9510`)
2. Selecionar o campo: `GO`, `MT` ou `MS`
3. Pressionar Enter ou clicar em **Adicionar**
4. A campanha aparece imediatamente para todos os usuários do campo correspondente

### Remover campanha
Passar o mouse sobre a campanha na lista → clicar no ícone 🗑️ que aparece.

> As alterações são salvas instantaneamente no banco (`config_global.campanhas`).

---

## 3. Deploy em produção

### Fluxo normal
1. Desenvolvedor cria branch, faz as alterações, abre Pull Request no GitHub
2. Admin (ou outro desenvolvedor) revisa e aprova o PR
3. Faz merge do PR na `main`
4. Vercel detecta automaticamente e publica em ~2 minutos

### Verificar o status do deploy
Acessar **Vercel → Deployments** — lista todos os deploys com status e logs.

### Forçar redeploy sem mudança de código
Útil quando variáveis de ambiente foram alteradas:
**Vercel → Deployments → botão "Redeploy"** no deploy mais recente.

### Nunca fazer
- Push direto na `main` (sempre via PR)
- Adicionar variáveis de ambiente pelo terminal `vercel env add` (corrompe encoding)
- Commitar o arquivo `.env.local`

---

## 4. Resolver problemas comuns

### Usuário não consegue fazer login
1. Verificar se o e-mail existe em **Supabase → Authentication → Users**
2. Se necessário, usar **"Send password reset"** para o usuário redefinir a senha
3. Verificar se as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretas no Vercel

### Campanha não aparece para o operador
1. Verificar se a campanha está cadastrada em `/admin → Campanhas`
2. Verificar se o campo da campanha bate com o campo do operador em `/admin → Usuários`

### Estoque zerou incorretamente
Pode ter ocorrido dedução duplicada ou importação incorreta. Usar o **SQL Editor do Supabase** para corrigir:
```sql
-- Ver saldo atual de um produto em um depósito
SELECT * FROM inventory
WHERE product_id = '<id-do-produto>'
  AND warehouse_id = '<id-do-deposito>';

-- Corrigir manualmente
UPDATE inventory
SET quantity = <novo-valor>
WHERE product_id = '<id-do-produto>'
  AND warehouse_id = '<id-do-deposito>';
```

### Deploy com erro no Vercel
1. Acessar **Vercel → Deployments** → clicar no deploy com erro → ver logs
2. Erros mais comuns: TypeScript com erro de tipo, import inexistente, variável de ambiente faltando
3. Corrigir na branch, fazer novo commit → Vercel refaz o build automaticamente

---

## 5. Referência rápida — onde cada coisa fica

| O que fazer | Onde |
|-------------|------|
| Criar usuário | Supabase → Authentication → Users |
| Definir papel/campo do usuário | Sistema → /admin → Usuários |
| Adicionar/remover campanha | Sistema → /admin → Campanhas |
| Ver logs de deploy | Vercel → Deployments |
| Alterar variável de ambiente | Vercel → Settings → Environment Variables |
| Executar SQL manual | Supabase → SQL Editor |
| Ver dados das tabelas | Supabase → Table Editor |
| Ver arquivos no Storage | Supabase → Storage |
| Ver/deletar usuários | Supabase → Authentication → Users |
