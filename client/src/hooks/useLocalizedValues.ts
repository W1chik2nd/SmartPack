import { useTranslatedText } from "./useTranslatedText";
import type { Lang } from "../i18n/strings";

/** Prefer stored bilingual values; ask the backend translator only for missing variants. */
export function useLocalizedValues(
  pairs: { zh: string; en: string }[],
  lang: Lang
): string[] {
  const selected = pairs.map((pair) => {
    const value = lang === "zh" ? pair.zh : pair.en;
    return value || (lang === "zh" ? pair.en : pair.zh);
  });
  return useTranslatedText(selected, lang);
}
