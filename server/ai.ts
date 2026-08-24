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

export type JsonSchema = Record<string, unknown>;

/**
 * Read the assistant's structured text from a raw Responses API payload.
 * The provider response is an external trust boundary, so this is the single
 * place where its shape is checked before JSON.parse sees it.
 */
export function responseText(data: unknown): string {
  const response = data as {
    output?: {
      type?: string;
      content?: { type?: string; text?: string; refusal?: string }[];
    }[];
  };
  for (const item of response?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error(`AI provider refused the trip request: ${content.refusal}`);
      }
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("AI provider returned no structured trip plan.");
}

/** GPT-5.6 trip-planning call: reasoning + web grounding + strict JSON. */
export async function structuredResponse<T>(options: {
  instructions: string;
  input: unknown;
  schema: JsonSchema;
  safetyIdentifier: string;
}): Promise<T> {
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.TRIP_AGENT_MODEL ?? "gpt-5.6-terra";
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      instructions: options.instructions,
      input: JSON.stringify(options.input),
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "smartpack_trip_plan",
          strict: true,
          schema: options.schema,
        },
      },
      // A 30-day bilingual itinerary can be large, and reasoning tokens share
      // this budget. Terra supports up to 64k output tokens.
      max_output_tokens: 64_000,
      safety_identifier: options.safetyIdentifier,
      store: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI trip planner request failed (${res.status})`);
  }
  const text = responseText(await res.json());
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI trip planner returned invalid JSON.");
  }
}

export async function chatCompletion(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";

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
