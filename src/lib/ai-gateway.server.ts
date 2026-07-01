import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiOverride } from "./ai-override";

const DEFAULT_LOVABLE_MODEL = "google/gemini-3-flash-preview";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

function createGroqProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// Returns an AI SDK model instance. When `override` is provided, the
// call is routed to that user-owned provider (currently Groq). Otherwise
// the default Lovable AI Gateway model is returned — this preserves the
// original app behaviour exactly.
export function resolveAiModel(override?: AiOverride) {
  if (override && override.provider === "groq") {
    return createGroqProvider(override.apiKey)(override.model);
  }
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(apiKey)(DEFAULT_LOVABLE_MODEL);
}
