# Módulo Fiorino

## O que é
Ferramenta de planejamento visual de carregamento do veículo Fiorino. Permite organizar caixas no espaço do baú antes do envio, calculando a ocupação.

---

## Como usar

**Rota:** `/fiorino`

### Criar um plano de carregamento

1. Clicar em **Novo plano**
2. Preencher:
   - **Data** do carregamento
   - **Campo** (GO / MT / MS)
   - **Campanha** vinculada (opcional)
   - **Tipo** de carregamento
   - **Observações** (opcional)
3. Na tela de edição, arrastar e posicionar caixas no grid visual do baú
4. O sistema calcula automaticamente a **ocupação (%)** e o **número de caixas**
5. Salvar o plano

### Histórico de planos

Os últimos **5 planos** ficam salvos. Quando um novo plano é criado e o limite é atingido, o mais antigo é removido automaticamente.

### Visualizar um plano salvo

Na lista de planos, clicar em qualquer um para ver o layout salvo com as caixas posicionadas.

---

## Para desenvolvedores

### Onde fica o código
```
app/(main)/fiorino/
  page.tsx     → Lista de planos e criação
  viewer.tsx   → Grid visual de posicionamento de caixas (tipo PlacedBox)
```

### Tabela no banco
```
fiorino_plans
  id            UUID (PK)
  created_by    UUID → auth.users (nullable)
  date          TEXT
  campo         TEXT
  campaign_code TEXT
  type          TEXT
  notes         TEXT
  boxes         JSONB  ← array de PlacedBox com posição e dimensões
  occupancy_pct NUMERIC
  box_count     INTEGER
  created_at    TIMESTAMPTZ
```

### Tipo PlacedBox
Definido em `app/(main)/fiorino/viewer.tsx` e re-exportado por `lib/db.ts`:
```typescript
interface PlacedBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // ... outros atributos de posicionamento
}
```

### Queries
`lib/supabase-db.ts` — funções `getFiorinoPlans`, `addFiorinoPlan`, `deleteFiorinoPlan`. O limite de 5 planos é aplicado em `addFiorinoPlan` — ao inserir, exclui os mais antigos que excedam o limite.
