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

/** The Agent shares AI_MODEL unless an explicit per-agent model is requested. */
export function tripAgentModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.TRIP_AGENT_MODEL ?? env.AI_MODEL ?? "gpt-5.6-terra";
}

type StructuredResponseOptions = {
  instructions: string;
  input: unknown;
  schema: JsonSchema;
  safetyIdentifier: string;
};

/** Keep useful provider diagnostics without reflecting arbitrary response data. */
export function providerErrorMessage(data: unknown): string | null {
  const message = (data as { error?: { message?: unknown } })?.error?.message;
  if (typeof message !== "string") return null;
  const compact = message.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 500) : null;
}

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

/**
 * OpenAI supports safety_identifier, but some Responses-compatible gateways do
 * not. Only send the optional field to an official OpenAI API hostname.
 */
export function structuredResponseRequestBody(
  options: StructuredResponseOptions,
  baseUrl: string,
  model: string
): Record<string, unknown> {
  const normalizedModel = model.toLowerCase();
  const isGpt5 = /^gpt-5(?:[.-]|$)/.test(normalizedModel);
  const supportsReasoning = isGpt5 || /^o\d(?:[.-]|$)/.test(normalizedModel);
  const body: Record<string, unknown> = {
    model,
    instructions: options.instructions,
    input: JSON.stringify(options.input),
    tools: [{ type: "web_search" }],
    text: {
      format: {
        type: "json_schema",
        name: "smartpack_trip_plan",
        strict: true,
        schema: options.schema,
      },
    },
    // GPT-4o mini supports at most 16,384 output tokens. GPT-5 itineraries can
    // use the larger budget because reasoning tokens share this same limit.
    max_output_tokens: /^gpt-4o(?:[.-]|$)/.test(normalizedModel)
      ? 16_000
      : 64_000,
    store: false,
  };

  // OpenAI exposes reasoning controls only for GPT-5 and o-series models.
  // Likewise, verbosity is a GPT-5 control; omitting unsupported optional
  // parameters keeps Responses-compatible models such as gpt-4o-mini valid.
  if (supportsReasoning) body.reasoning = { effort: "medium" };
  if (isGpt5) {
    (body.text as Record<string, unknown>).verbosity = "medium";
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname === "api.openai.com" || hostname.endsWith(".api.openai.com")) {
      body.safety_identifier = options.safetyIdentifier;
    }
  } catch {
    // fetch will report an invalid base URL; it is not an OpenAI hostname.
  }
  return body;
}

/** Model-aware trip-planning call with web grounding and strict JSON. */
export async function structuredResponse<T>(
  options: StructuredResponseOptions
): Promise<T> {
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  const model = tripAgentModel();
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify(structuredResponseRequestBody(options, baseUrl, model)),
  });

  if (!res.ok) {
    const detail = providerErrorMessage(await res.json().catch(() => null));
    throw new Error(
      `AI trip planner request failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
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
