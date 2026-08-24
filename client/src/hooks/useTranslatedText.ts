import { useEffect, useState } from "react";
import { translateTexts } from "../api";
import type { Lang } from "../i18n/strings";

function needsTranslation(text: string, target: Lang): boolean {
  if (!text.trim()) return false;
  const hasHan = /[\u3400-\u9fff]/.test(text);
  return target === "zh" ? !hasHan : hasHan;
}

/** Translate visible values whose stored language does not match the UI choice. */
export function useTranslatedText(texts: string[], target: Lang): string[] {
  const key = `${target}:${texts.join("\u001f")}`;
  const [translated, setTranslated] = useState(texts);

  useEffect(() => {
    let alive = true;
    setTranslated(texts);
    const indexes = texts
      .map((text, index) => (needsTranslation(text, target) ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length === 0) {
      return () => {
        alive = false;
      };
    }
    translateTexts(indexes.map((index) => texts[index]), target)
      .then(({ translations }) => {
        if (!alive) return;
        const next = [...texts];
        indexes.forEach((index, translationIndex) => {
          next[index] = translations[translationIndex] || texts[index];
        });
        setTranslated(next);
      })
      .catch(() => {
        // The source value remains visible when AI is unavailable.
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return translated;
}
