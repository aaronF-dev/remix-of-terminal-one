import { z } from "zod";

// Shared, client + server safe. Describes an optional user-provided
// override for the AI model used by the main app's server functions.
// If absent, the server falls back to the Lovable AI Gateway (unchanged
// default). If present, the server routes the call to that provider.
export const AiOverrideSchema = z.object({
  provider: z.literal("groq"),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});
export type AiOverride = z.infer<typeof AiOverrideSchema>;

// Local-storage keys, shared with the API Key settings page.
export const GROQ_LS_KEY = "t1.groq.apiKey";
export const GROQ_LS_MODEL = "t1.groq.model";
export const GROQ_LS_ENABLED = "t1.groq.enabled";

// Reads the user's stored override on the client. Returns undefined
// on the server, when nothing is saved, or when the user has not
// enabled "use for main app".
export function getAiOverride(): AiOverride | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    if (localStorage.getItem(GROQ_LS_ENABLED) !== "1") return undefined;
    const apiKey = localStorage.getItem(GROQ_LS_KEY);
    const model = localStorage.getItem(GROQ_LS_MODEL);
    if (!apiKey || !model) return undefined;
    return { provider: "groq", apiKey, model };
  } catch {
    return undefined;
  }
}
