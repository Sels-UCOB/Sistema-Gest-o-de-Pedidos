# Módulo de Estoque e Produtos

## O que é
Gerencia o catálogo de produtos e as quantidades disponíveis em cada depósito. Também permite realizar contagens físicas de inventário.

---

## Depósitos disponíveis

| ID | Nome | Campo |
|----|------|-------|
| `SEDE_EXT` | Sede — Externo | GO |
| `SEDE_UNION` | Sede — The Union | GO |
| `SEDE_CONT` | Sede — Container | GO |
| `MT_EST` | MT — Estoque | MT |
| `MT_ALM` | MT — Externo ALM | MT |
| `MS_EST` | MS — Estoque | MS |
| `MS_ALM` | MS — Depósito Novo ALM | MS |

Operadores veem apenas os depósitos do seu campo. Admins veem todos.

---

## Parte 1 — Catálogo de Produtos (`/products`)

### Importar catálogo pelo XLS do ACS

É a forma mais rápida de cadastrar ou atualizar produtos e saldos em massa.

1. No ACS, exportar o relatório de estoque em Excel (`.xls` ou `.xlsx`)
2. Em `/products`, clicar em **Importar XLS**
3. Selecionar o arquivo — o sistema detecta automaticamente as colunas de produto e saldo
4. Confirmar — produtos novos são criados, existentes têm o saldo atualizado no depósito selecionado

> O sistema processa em lotes de 500 itens para não sobrecarregar.

### Adicionar produto manualmente (entrada de material)

Use quando receber material avulso que não está no XLS.

1. No painel lateral direito em `/products`, preencher:
   - **Código** do produto (se já existir no catálogo, ele é reconhecido automaticamente)
   - **Nome** (obrigatório se for produto novo)
   - **Depósito** de destino
   - **Quantidade** a adicionar
2. Clicar em **Registrar entrada**
3. O sistema **soma** ao saldo existente (não substitui)

### Visualizar estoque

- Selecionar o depósito no seletor no topo da página
- Ativar **"Somente em estoque"** para ver apenas produtos com quantidade > 0
- Buscar pelo nome ou código do produto

### Editar nome de um produto

Clicar no ícone de lápis ✏️ ao lado do produto → editar inline → Enter para salvar.

### Deletar produto

Clicar no ícone de lixeira 🗑️ → confirmar. Remove o produto e todos os registros de estoque dele em todos os depósitos.

> ⚠️ Pedidos já criados com esse produto continuam existindo — o nome fica como estava no momento da criação.

---

## Parte 2 — Contagem de Inventário (`/estoque`)

Permite realizar um inventário físico colaborativo, comparando o saldo do sistema com o que foi contado fisicamente.

### Criar uma nova sessão de contagem

1. Acessar `/estoque` → botão **Nova contagem**
2. **Passo 1 — Importar XLS:** carregar o arquivo de estoque do ACS (pode ser mais de um arquivo). Esses dados viram a "lista de referência" da contagem.
3. **Passo 2 — Identificação:** confirmar seu nome e informar o local da contagem (ex: "Estoque Externo UCOB")
4. **Passo 3 — Confirmação:** revisar e clicar em **Iniciar contagem**

### Contar os itens

Na aba **Contar**:
- Produtos agrupados por categoria (expansíveis)
- Busca por nome, código ou EAN
- Filtros: **Todos / Pendentes / Contados**
- Clicar em um produto → abre modal → usar +/- ou digitar a quantidade → confirmar
- Itens contados ficam marcados com ponto verde ●

### Participar da sessão de outro usuário

Se alguém do mesmo campo já criou uma sessão ativa, ela aparece na tela inicial do `/estoque`. Clicar em **Participar** para contar junto em tempo real.

### Ver o relatório durante a contagem

Na aba **Relatório**:
- Totais: itens contados, sobras, faltas, conferidos
- Valor do sistema vs. valor contado vs. diferença
- Tabela completa com situação de cada item
- Botão **Exportar Excel** para baixar o relatório

### Encerrar a sessão

Clicar em **Encerrar sessão** → a sessão fica arquivada no histórico. Apenas o criador da sessão pode encerrar.

### Histórico de sessões

Botão **Sessões** no topo → lista das últimas 50 sessões (ativas e encerradas). Clicar em uma sessão encerrada para ver ou exportar o relatório.

---

## Para desenvolvedores

### Onde fica o código
- Catálogo: `app/(main)/products/page.tsx`
- Contagem: `app/(main)/estoque/page.tsx`
- Queries: `lib/supabase-db.ts` (seções `Products`, `Inventory`, `Inventory Sessions`)

### Tabelas no banco
```
products
  id    UUID (PK)
  name  TEXT

inventory
  product_id    UUID → products.id
  warehouse_id  TEXT (ID do depósito, ex: "SEDE_EXT")
  quantity      INTEGER
  PK: (product_id, warehouse_id)

inventory_sessions
  id            UUID (PK)
  user_id       UUID → auth.users
  campo         TEXT
  counter_name  TEXT
  location      TEXT
  status        TEXT (active | completed)
  item_count    INTEGER
  counted_items INTEGER
  items         JSONB  ← lista de referência do XLS
  started_at    TIMESTAMPTZ
  ended_at      TIMESTAMPTZ

inventory_counts
  id          UUID (PK)
  session_id  UUID → inventory_sessions.id
  item_code   TEXT
  item_name   TEXT
  group_name  TEXT
  saldo       NUMERIC  ← saldo no sistema (do XLS)
  custo       NUMERIC
  counted_qty INTEGER  ← o que foi contado fisicamente
  counted_at  TIMESTAMPTZ
  UNIQUE (session_id, item_code)
```

### RPCs de inventário
- `add_inventory(product_id, warehouse_id, quantity)` — soma ao saldo
- `deduct_inventory(product_id, warehouse_id, quantity)` — subtrai do saldo (mínimo 0)
- `bulk_set_inventory(rows)` — define saldos em massa (usado na importação XLS)

### Depósitos configurados em código
`lib/campos.ts` — constante `WAREHOUSES` com id, label e campo de cada depósito. Para adicionar um depósito novo, edite essa constante e atualize o banco conforme necessário.
