# Módulo de Campanhas e Acertos

## O que é
Gerencia o ciclo financeiro de uma campanha de colportagem: importação de dados do ACS, lançamentos manuais, escalas, bolsas e encerramento.

---

## Fluxo de um acerto

```
Criar acerto (campo, tipo, campanha)
    ↓
Importar escala do ACS (arquivo XLS)
    ↓
Registrar lançamentos (créditos e débitos)
    ↓
Identificar bolsas (quem bateu meta)
    ↓
Gerar relatório / encerrar
```

---

## Acessar o módulo

**Rota:** `/campanhas`

O menu lateral exibe as subseções:
- **Acertos** — lista e cria acertos
- **Lançamentos** — lançamentos financeiros do acerto ativo
- **Lançamentos de Líderes** — lançamentos específicos dos líderes
- **Escalas** — importação e visualização das escalas do ACS
- **Bolsas** — identificação de colportores que bateram bolsa
- **Encerramento** — fechar o acerto e gerar relatório final
- **Configurações** — tipos de campanha, campos, líderes cadastrados

---

## 1. Criar um acerto

**Rota:** `/campanhas/acertos` → botão **Novo acerto**

Preencher:
- **Nome** do acerto (ex: "ABC Junho 2025")
- **Campo** (GO / MT / MS)
- **Tipo de campanha** (configurado em Configurações)
- **Data de criação**

---

## 2. Escalas — importar do ACS

**Rota:** `/campanhas/escalas`

1. Exportar o relatório de escala do ACS em Excel
2. Clicar em **Importar XLS** → selecionar o arquivo
3. O sistema lê os dados de cada colportor: nome, saldo vendido, metas, etc.
4. Os dados ficam vinculados ao acerto selecionado

Múltiplos arquivos podem ser importados para o mesmo acerto (dados são mesclados).

Para ver o relatório de escala importado, clicar em qualquer arquivo na lista — abre preview com os dados completos.

---

## 3. Lançamentos

**Rota:** `/campanhas/lancamentos`

Registra créditos e débitos financeiros do acerto: devoluções, adiantamentos, gastos, etc.

### Adicionar lançamento
1. Selecionar o tipo de lançamento (configurado em Configurações → Tipos)
2. Informar o valor e histórico (descrição)
3. Confirmar

Os lançamentos podem ser reordenados por arraste. O saldo é recalculado automaticamente.

### Lançamentos de líderes
**Rota:** `/campanhas/lancamentos-lideres`

Mesmo funcionamento, porém específico para lançamentos de líderes cadastrados em Configurações.

---

## 4. Bolsas

**Rota:** `/campanhas/bolsas`

Identifica quais colportores bateram a meta de bolsa na campanha.

1. Com a escala já importada, o sistema calcula automaticamente quem atingiu a meta
2. É possível ajustar manualmente casos especiais
3. A lista de bolsas fica vinculada ao acerto

---

## 5. Encerramento

**Rota:** `/campanhas/encerramento`

Gera o resumo financeiro final do acerto:
- Total de vendas
- Lançamentos registrados
- Saldo líquido
- Lista de bolsas

Após conferência, clicar em **Encerrar acerto** → status muda para `encerrado`.

---

## 6. Configurações

**Rota:** `/campanhas/configuracoes`

Define os dados de referência usados em todo o módulo:

| Item | Descrição |
|------|-----------|
| **Tipos de campanha** | Ex: "Regular", "Especial", "Jovens" |
| **Campos** | Regiões (GO, MT, MS) — normalmente fixos |
| **Líderes** | Nomes dos líderes para lançamentos específicos |

Alterações são salvas automaticamente no banco (tabela `config_global`).

---

## Para desenvolvedores

### Onde fica o código
```
app/(main)/campanhas/
  page.tsx                   → Hub do módulo
  acertos/page.tsx           → Lista e criação de acertos
  lancamentos/page.tsx       → Lançamentos
  lancamentos-lideres/       → Lançamentos de líderes
  escalas/page.tsx           → Importação e visualização de escalas
  bolsas/page.tsx            → Bolsas
  encerramento/page.tsx      → Encerramento
  configuracoes/page.tsx     → Tipos, campos, líderes

lib/campanhas/               → Lógica, tipos e queries do módulo
components/campanhas/        → Componentes específicos do módulo
```

### Tabelas no banco
```
acertos
  id               TEXT (PK)
  nome             TEXT
  campo            TEXT
  tipo_campanha    TEXT
  status           TEXT
  data_criacao     TIMESTAMPTZ
  data_encerramento TIMESTAMPTZ
  lote_aasi        TEXT

acerto_state        → estado serializado do acerto (dados calculados)
acerto_lancamentos  → lançamentos financeiros (id, tipo, valor, histórico, posição)
acerto_lider        → carta de bolsa e juros por líder
acerto_debitos      → devedores, gastos de líderes e caixa
acerto_bolsas       → colportores que bateram bolsa (dados + origem)
acerto_anexos       → arquivos XLS importados (soft-delete via deleted_at)
```

### Configuração global
Os tipos, campos e líderes ficam na tabela `config_global` (linha única, id=1), gerenciados por `lib/campanhas/context/ConfiguracaoContext.tsx`. O contexto salva com debounce de 800ms sempre que os dados mudam.

### RLS
Acertos e todas as tabelas filhas são filtrados por campo: operadores só acessam acertos do próprio campo. Admins veem tudo. Implementado via `is_admin()` e `my_campo()` em `supabase/migrations/20260615000000_security_rls_restricoes.sql`.
