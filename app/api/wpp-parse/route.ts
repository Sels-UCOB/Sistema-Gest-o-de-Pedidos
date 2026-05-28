import { NextRequest, NextResponse } from "next/server";

type Candidate = { id: string; name: string };
type ItemWithCandidates = { qty: number; rawText: string; options: Candidate[] };

export async function POST(req: NextRequest) {
  const { message, candidates } = await req.json() as {
    message: string;
    candidates: ItemWithCandidates[];
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 400 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: "no_candidates" }, { status: 400 });
  }

  // Build a focused prompt — Groq sees only the pre-filtered candidates per item
  const itemLines = candidates
    .map((c, i) => {
      const opts = c.options.map(o => `  - ${o.name}`).join("\n");
      return `Item ${i + 1}: "${c.rawText}" (quantidade: ${c.qty})\nOpções:\n${opts}`;
    })
    .join("\n\n");

  const systemPrompt = `Você é um assistente que identifica pedidos de livros e materiais evangelísticos adventistas a partir de mensagens informais de WhatsApp em português brasileiro. Responda sempre com JSON válido.`;

  const userPrompt = `Mensagem original do cliente: "${message}"

Para cada item abaixo, escolha a opção que melhor representa o que o cliente pediu. Use o nome EXATO de uma das opções listadas.

${itemLines}

Responda APENAS com JSON, sem texto extra, mantendo a mesma ordem dos itens:
[{"qty": 1, "productName": "nome exato da opção escolhida"}]`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const items: { qty: number; productName: string }[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];

    return NextResponse.json({ items });
  } catch (e) {
    console.error("Groq wpp-parse error:", e);
    return NextResponse.json({ error: "groq_failed" }, { status: 500 });
  }
}
