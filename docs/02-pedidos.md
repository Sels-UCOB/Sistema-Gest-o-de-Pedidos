# Módulo de Pedidos

## O que é
Gerencia o ciclo completo de um pedido: criação → separação física → envio → relatório.

---

## Fluxo completo

```
Criar pedido
    ↓
Separar pedido (marcar itens + fotos)
    ↓
Pedido fechado (status: closed)
    ↓
Agrupar em envio
    ↓
Anexar comprovante
    ↓
Pedido enviado (status: shipped)
```

---

## 1. Criar um pedido

**Rota:** `/orders` → aba **Criar**

### Campos obrigatórios
| Campo | Descrição |
|-------|-----------|
| Nome do cliente | Mínimo 3 letras, sem números |
| Campanha | Código da campanha (ex: `ALM - 9381`) — filtrado pelo campo do usuário |
| Depósito | De onde os produtos serão retirados — aparece automaticamente pela campanha |
| Cidade de destino | Mínimo 3 letras, sem números |
| Tipo | `Envio` (material físico) ou `Acerto` |
| Itens | Lista de produtos e quantidades |

### Adicionar itens — modo texto (WPP)
Cole o texto de uma mensagem de WhatsApp no campo de texto e clique em **Interpretar**. O sistema identifica automaticamente produtos e quantidades.

Exemplos que funcionam:
```
3 bíblias
2x pr. mensagem
10 lição adulto
```

O parser entende: `quantidade + nome`, `quantidadeX nome`, e listas com um item por linha.

Após interpretar, os itens aparecem como cards. Itens não reconhecidos ficam marcados em vermelho — você pode ajustar manualmente antes de confirmar.

### Adicionar itens — modo manual
Clique em **+ Item**, busque o produto pelo nome e defina a quantidade.

### Confirmar o pedido
Clique em **Criar pedido**. O sistema:
1. Valida os campos obrigatórios
2. Alerta se algum item estiver sem estoque suficiente
3. Registra o pedido com status `pending`
4. Deduz automaticamente do estoque do depósito selecionado

---

## 2. Separar um pedido

**Rota:** `/orders` → aba **Gerenciar** → botão **Separar** no pedido

### O que é separação
O operador fisicamente pega cada item do estoque e marca como separado no sistema. Pode tirar foto de cada item.

### Passos
1. Abrir o pedido clicando em **Separar**
2. Para cada item: marcar o checkbox ✓ (e opcionalmente tirar foto com 📷)
3. Ao terminar todos os itens: tirar foto da **caixa embalada**
4. Clicar em **Fechar pedido** → status muda para `closed`

### Status possíveis
| Status | Significado |
|--------|-------------|
| `pending` | Pedido criado, aguardando separação |
| `separating` | Separação em andamento |
| `closed` | Separação concluída, pronto para envio |
| `shipped` | Incluído em um envio |

---

## 3. Criar um envio

**Rota:** `/shipments` → botão **Novo envio**

Um envio agrupa um ou mais pedidos `closed` que serão despachados juntos.

### Tipos de envio
| Tipo | Quando usar |
|------|-------------|
| Transportadora | Despacho por transportadora — informar nome e telefone |
| Presencial | Retirada presencial — informar quem retirou |
| Acerto | Envio de material de acerto |

### Passos
1. Selecionar o tipo de envio
2. Preencher dados da transportadora ou responsável pela retirada
3. Selecionar a data de envio
4. Marcar os pedidos que fazem parte deste envio
5. Confirmar → pedidos marcados passam para status `shipped`

---

## 4. Comprovante de envio

**Rota:** `/shipments` → lista de envios → ícone 📷

Após o envio físico, tire foto do comprovante (recibo da transportadora, nota, etc.) e anexe ao envio. Podem ser múltiplos comprovantes.

---

## 5. Relatórios

**Rota:** `/reports`

Mostra todos os pedidos que já foram enviados (`shipped`), com filtros:

| Filtro | Opções |
|--------|--------|
| Período | Data inicial e final do envio |
| Campo | GO / MT / MS / Todos |
| Responsável | Filtra por quem criou o pedido |
| Tipo | Envio / Acerto / Todos |

Para imprimir: selecionar pedidos com os checkboxes → botão **Imprimir**.

---

## Para desenvolvedores

### Onde fica o código
- Página principal: `app/(main)/orders/page.tsx`
- Queries ao banco: `lib/supabase-db.ts` (funções `getOrdersPaged`, `addOrder`, `updateOrder`, `deleteOrder`)
- Tipos: `lib/db.ts` (interface `Order`, `OrderItem`)

### Tabela no banco
```
orders
  id               UUID (PK)
  user_id          UUID → auth.users
  customer_name    TEXT
  campaign_code    TEXT
  destination_city TEXT
  responsible      TEXT
  status           TEXT  (pending | separating | closed | shipped)
  tipo             TEXT  (envio | acerto)
  items            JSONB (array de OrderItem)
  packed_photo_url TEXT
  created_at       BIGINT (timestamp em ms)
  shipment_id      TEXT  → shipments.id
```

### RPC usadas
- `get_orders_slim()` — retorna pedidos sem URLs de foto (payload reduzido)
- `get_gallery_metadata()` / `get_gallery_metadata_paged()` — metadados da galeria
- `get_photos_bulk()` / `get_single_photo()` — URLs de fotos por demanda

### Parser de texto (WPP)
Localizado no topo de `app/(main)/orders/page.tsx`. Funciona em duas etapas:
1. `extractFragments()` — identifica pares (quantidade, nome) no texto
2. `findBestMatch()` em `lib/string-utils.ts` — encontra o produto mais próximo no catálogo por similaridade de string
