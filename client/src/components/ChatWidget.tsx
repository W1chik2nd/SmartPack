import { useEffect, useRef, useState, type FormEvent } from "react";
import { chat, type ChatMessage } from "../api";

// The assistant's opening line is presentation only — real conversation
// turns go through /api/chat, where the server owns the prompt and the
// personalization (thin client per AGENTS.md §3).
const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your SmartPack assistant. Ask me what to wear today, or tell me about a trip — destination, dates, occasions — and I'll plan outfits and a packing list.",
};

/**
 * Floating chat launcher (bottom-right) plus the assistant dialog.
 * Kept independent of any page so it can be mounted wherever the
 * assistant should be available.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message visible; focus the input when the dialog opens.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setInput("");
    // The greeting is local flavor, not part of the model conversation.
    const history = [...messages.filter((m) => m !== GREETING), { role: "user" as const, content: text }];
    setMessages([GREETING, ...history]);
    setBusy(true);
    try {
      const { reply } = await chat(history);
      setMessages([GREETING, ...history, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section
          className="chat-panel"
          role="dialog"
          aria-label="SmartPack assistant"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <header className="chat-header">
            <h2>Assistant</h2>
            <button
              className="chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

          <div className="chat-log" ref={logRef} aria-live="polite">
            {messages.map((m, i) => (
              <p key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </p>
            ))}
            {busy && <p className="chat-msg assistant chat-thinking">Thinking…</p>}
            {error && (
              <p className="chat-msg chat-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSend}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about outfits or packing…"
              aria-label="Message the assistant"
            />
            <button type="submit" disabled={busy || input.trim().length === 0}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        className="chat-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close SmartPack assistant" : "Open SmartPack assistant"}
      >
        {/* Bauhaus speech bubble: rectangle + triangle tail, three primary
            dots. Pure geometry, colored via theme tokens in chat.css. */}
        <svg
          className="chat-icon"
          viewBox="0 0 28 28"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="chat-icon-bubble" x="2" y="4" width="24" height="15" />
          <polygon className="chat-icon-bubble" points="8,19 8,26 15,19" />
          <circle className="chat-icon-dot-red" cx="8.5" cy="11.5" r="2.2" />
          <circle className="chat-icon-dot-yellow" cx="14" cy="11.5" r="2.2" />
          <circle className="chat-icon-dot-blue" cx="19.5" cy="11.5" r="2.2" />
        </svg>
      </button>
    </>
  );
}
