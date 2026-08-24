import { chatCompletion } from "./ai.ts";

export type TranslationLanguage = "en" | "zh";

/** Translate a small visible batch in one provider call so pages do not fan out requests. */
export async function translateBatch(
  texts: string[],
  target: TranslationLanguage
): Promise<string[]> {
  if (texts.length === 0) return [];
  const language = target === "zh" ? "Simplified Chinese" : "English";
  const prompt = [
    `Translate each input into ${language}.`,
    "Return only a JSON array of strings in the same order.",
    "Keep names, numbers, dates, punctuation, and product meaning accurate.",
    "If an input is already natural in the target language, return it unchanged.",
    JSON.stringify(texts),
  ].join("\n");
  const content = await chatCompletion(
    "You are WearRoute's UI translation service. Never add explanations or markdown.",
    [{ role: "user", content: prompt }]
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI translation returned invalid JSON.");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== texts.length ||
    !parsed.every((value) => typeof value === "string")
  ) {
    throw new Error("AI translation returned an invalid result.");
  }
  return parsed;
}
