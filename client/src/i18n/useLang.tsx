// Language context: one provider at the root, one hook everywhere else.
// The selection is written to localStorage on every change, so it survives
// page refreshes and redirects; new tabs start from the stored value too.
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { STRINGS, type Lang, type StringKey } from "./strings";

const LANG_KEY = "smartpack_lang";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

function storedLang(): Lang {
  return localStorage.getItem(LANG_KEY) === "zh" ? "zh" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang);

  function setLang(next: Lang) {
    localStorage.setItem(LANG_KEY, next);
    setLangState(next);
  }

  const t = (key: StringKey) => STRINGS[key][lang];

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}
