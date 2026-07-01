import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, Send, Trash2, Zap } from "lucide-react";
import { GROQ_LS_ENABLED, GROQ_LS_KEY, GROQ_LS_MODEL } from "@/lib/ai-override";

export const Route = createFileRoute("/api-key")({
  component: ApiKeyPage,
  head: () => ({
    meta: [
      { title: "API Key · Terminal One" },
      {
        name: "description",
        content:
          "Bring your own Groq API key to run Groq-hosted models directly from Terminal One. Key stays on your device.",
      },
    ],
  }),
});

const GROQ_MODELS = [
  "allam-2-7b",
  "groq/compound",
  "groq/compound-mini",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-prompt-guard-2-22m",
  "meta-llama/llama-prompt-guard-2-86m",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
  "qwen/qwen3-32b",
  "qwen/qwen3.6-27b",
] as const;

const LS_KEY = GROQ_LS_KEY;
const LS_MODEL = GROQ_LS_MODEL;
const LS_ENABLED = GROQ_LS_ENABLED;

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

function ApiKeyPage() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [model, setModel] = useState<string>(GROQ_MODELS[3]);
  const [showKey, setShowKey] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [useForApp, setUseForApp] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(LS_KEY);
      const m = localStorage.getItem(LS_MODEL);
      const e = localStorage.getItem(LS_ENABLED);
      if (k) {
        setSavedKey(k);
        setApiKey(k);
      }
      if (m && (GROQ_MODELS as readonly string[]).includes(m)) setModel(m);
      if (e === "1") setUseForApp(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  function saveKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(LS_KEY, trimmed);
      localStorage.setItem(LS_MODEL, model);
      setSavedKey(trimmed);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 1500);
    } catch {
      setError("Could not save to local storage.");
    }
  }

  function clearKey() {
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_MODEL);
      localStorage.removeItem(LS_ENABLED);
    } catch {
      /* ignore */
    }
    setSavedKey(null);
    setApiKey("");
    setUseForApp(false);
    setMessages([]);
  }

  function toggleUseForApp(next: boolean) {
    setUseForApp(next);
    try {
      if (next) localStorage.setItem(LS_ENABLED, "1");
      else localStorage.removeItem(LS_ENABLED);
    } catch {
      /* ignore */
    }
  }

  function updateModel(next: string) {
    setModel(next);
    try {
      localStorage.setItem(LS_MODEL, next);
    } catch {
      /* ignore */
    }
  }

  async function sendMessage() {
    const key = savedKey || apiKey.trim();
    const text = input.trim();
    if (!key || !text || loading) return;
    setError(null);
    const nextMessages: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: nextMessages,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Groq ${res.status}: ${t.slice(0, 400)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content ?? "(empty response)";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const masked = savedKey
    ? `${savedKey.slice(0, 4)}${"•".repeat(Math.max(0, savedKey.length - 8))}${savedKey.slice(-4)}`
    : "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <KeyRound className="size-3.5 text-amber" /> Bring Your Own Key · Groq
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          Groq API Key & Playground
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your own Groq API key to call Groq-hosted models. Your key is saved{" "}
          <span className="text-foreground">only in this browser's local storage</span> — it
          never touches Terminal One servers, Lovable Cloud, or the main app's AI flow.
        </p>
      </div>

      {/* Key config card */}
      <section className="rounded-sm border border-border bg-card p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Credentials
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_260px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Groq API Key
            </span>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gsk_..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 pr-9 font-mono text-xs outline-none focus:border-amber"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              <button
                onClick={saveKey}
                disabled={!apiKey.trim()}
                className="flex items-center gap-1.5 rounded-sm bg-amber px-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                {savedNote ? <Check className="size-3.5" /> : null}
                Save
              </button>
            </div>
            {savedKey && (
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>
                  Saved key: <span className="font-mono normal-case text-foreground">{masked}</span>
                </span>
                <button
                  onClick={clearKey}
                  className="flex items-center gap-1 text-destructive hover:opacity-80"
                >
                  <Trash2 className="size-3" /> Clear
                </button>
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Model
            </span>
            <select
              value={model}
              onChange={(e) => updateModel(e.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-amber"
            >
              {GROQ_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-[10px] leading-relaxed text-muted-foreground">
              Get a key at{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-amber underline"
              >
                console.groq.com/keys
              </a>
              .
            </span>
          </label>
        </div>

        {/* Use-for-main-app toggle */}
        <div className="mt-4 flex items-start justify-between gap-4 rounded-sm border border-dashed border-border bg-background/60 p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-foreground">
              <Zap className="size-3.5 text-amber" /> Use my Groq key for the whole app
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              When enabled, AI Reasoning, Compare, Company DNA, Radar, News Intel, Ask
              Anything and AI Agents will route through your Groq model instead of Lovable
              AI. Everything else (market data, news feeds, saved research) is unchanged.
              Turn off to fall back to the default Lovable AI flow.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useForApp}
            onClick={() => toggleUseForApp(!useForApp)}
            disabled={!savedKey}
            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-border transition-colors disabled:opacity-40 ${
              useForApp ? "bg-amber" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 size-3.5 rounded-full bg-background transition-all ${
                useForApp ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </section>


      {/* Playground */}
      <section className="flex min-h-[420px] flex-col rounded-sm border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Groq Playground
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{model}</div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !loading && (
            <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
              {savedKey || apiKey.trim() ? (
                <span>Send a message to test the selected Groq model.</span>
              ) : (
                <span>Save your Groq API key above to start chatting.</span>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-sm px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-amber/15 text-foreground"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                <div className="mb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
                  {m.role}
                </div>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-amber" />
              Calling Groq…
            </div>
          )}
          {error && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-end gap-2 border-t border-border p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            rows={2}
            placeholder={
              savedKey || apiKey.trim()
                ? "Ask the Groq model anything…"
                : "Save your API key first."
            }
            disabled={!(savedKey || apiKey.trim()) || loading}
            className="flex-1 resize-none rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-amber disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !(savedKey || apiKey.trim()) || loading}
            className="flex h-[42px] items-center gap-1.5 rounded-sm bg-amber px-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-3.5" /> Send
          </button>
        </form>
      </section>
    </div>
  );
}
