import { type IncomingMessage, type ServerResponse } from "node:http";
import { aiConfigured } from "./ai.ts";
import { translateBatch, type TranslationLanguage } from "./translate.ts";

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  userFromHeader: () => { id: string } | null;
};

/** Authenticated fallback for database text that has no reliable second language. */
export async function handleTranslationRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, json, readBody, userFromHeader } = ctx;
  if (req.method !== "POST" || url.pathname !== "/api/translate") return false;
  if (!userFromHeader()) {
    json(res, 401, { error: "Not signed in." });
    return true;
  }
  if (!aiConfigured()) {
    json(res, 503, { error: "AI translation is not configured." });
    return true;
  }
  const body = await readBody(req, 200_000);
  const target = body?.target;
  const texts = body?.texts;
  if (
    (target !== "en" && target !== "zh") ||
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > 40 ||
    !texts.every((text: unknown) => typeof text === "string" && text.length <= 800)
  ) {
    json(res, 400, { error: "Invalid translation request." });
    return true;
  }
  try {
    json(res, 200, { translations: await translateBatch(texts, target as TranslationLanguage) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    json(res, 502, { error: message });
  }
  return true;
}
