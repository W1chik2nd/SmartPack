// LLM provider adapter — the only file that talks to the AI vendor.
//
// Configuration comes from environment variables (server/.env, loaded via
// --env-file-if-exists; see server/.env.example). The API key never lives in
// code or in the database (AGENTS.md §5). The endpoint speaks the
// OpenAI-compatible chat-completions protocol, which nearly every provider
// (OpenAI, DeepSeek, Moonshot, local Ollama, …) accepts, so switching vendors
// is a matter of changing AI_BASE_URL and AI_MODEL — no code changes.

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export async function chatCompletion(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-5.6-terra";

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    // Provider responses are external data: surface the status, not the body,
    // which can contain anything.
    throw new Error(`AI provider request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || reply.length === 0) {
    throw new Error("AI provider returned an empty reply.");
  }
  return reply;
}
