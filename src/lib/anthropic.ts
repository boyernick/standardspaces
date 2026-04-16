// Minimal Anthropic Messages API client — scoped to what photo curation
// needs: a multimodal call with several image blocks and forced tool-use
// so Claude returns a strict JSON payload. Avoids the @anthropic-ai/sdk
// dependency for now; if callers multiply we can swap this for the SDK.

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

// Sonnet 4.6 with vision runs well under 60s even for 20 images; 120s is
// a generous ceiling that still keeps us inside Vercel's function limit.
const TIMEOUT_MS = 120_000;

export class AnthropicError extends Error {
  httpStatus: number;
  stage: string;
  constructor(status: number, stage: string, message: string) {
    super(`Anthropic ${stage} failed (${status}): ${message}`);
    this.name = "AnthropicError";
    this.httpStatus = status;
    this.stage = stage;
  }
}

export interface ImageSource {
  /** Full https:// URL to the image. Anthropic fetches it server-side. */
  url: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  // JSON Schema for the tool's input. We coerce Claude to emit output by
  // listing this as the ONLY legal tool and using `tool_choice` below.
  input_schema: Record<string, unknown>;
}

export interface MultimodalToolCallOptions {
  system: string;
  userText: string;
  images: ImageSource[];
  tool: ToolSpec;
  /** Override via env or per-call. Defaults to claude-sonnet-4-6. */
  model?: string;
  maxTokens?: number;
}

export interface MultimodalToolCallResult<T> {
  /** Parsed tool input — the structured JSON we care about. */
  data: T;
  /** Token usage so the caller can log cost. */
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Call Claude with N image blocks + a forced tool-use schema. Returns the
 * parsed tool input cast to T. Throws `AnthropicError` on transport,
 * auth, schema, or parse failures so the API route can surface a stage.
 */
export async function multimodalToolCall<T = unknown>(
  options: MultimodalToolCallOptions,
): Promise<MultimodalToolCallResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError(500, "config", "ANTHROPIC_API_KEY is not set");
  }

  const model = options.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  // Build the user content: N image blocks, each tagged by a preceding
  // text block with its index so Claude can refer back to it in the tool
  // output. Numbering makes alignment with the returned `index` reliable.
  const content: Array<Record<string, unknown>> = [];
  content.push({ type: "text", text: options.userText });
  options.images.forEach((img, i) => {
    content.push({ type: "text", text: `Image ${i}:` });
    content.push({
      type: "image",
      source: { type: "url", url: img.url },
    });
  });

  const body = {
    model,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    tools: [options.tool],
    // Force Claude to call our tool — it cannot return free text instead.
    tool_choice: { type: "tool", name: options.tool.name },
    messages: [{ role: "user", content }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    throw new AnthropicError(0, "network", message);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AnthropicError(res.status, "api", text.slice(0, 500) || res.statusText);
  }

  const payload = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  // Find the tool_use block matching our tool name. Messages API returns
  // an array of content blocks; we want the one whose `name` matches.
  const toolBlock = payload.content?.find(
    (c) => c.type === "tool_use" && c.name === options.tool.name,
  );
  if (!toolBlock || typeof toolBlock.input !== "object" || toolBlock.input === null) {
    throw new AnthropicError(502, "parse", "Claude returned no tool_use block");
  }

  return {
    data: toolBlock.input as T,
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Estimate cost in USD for a Sonnet 4.6 call given token usage.
 * Sonnet 4.6: $3 / 1M input, $15 / 1M output.
 * Used for provenance logging, not billing.
 */
export function estimateSonnetCost(usage: { inputTokens: number; outputTokens: number }): number {
  return (usage.inputTokens * 3) / 1_000_000 + (usage.outputTokens * 15) / 1_000_000;
}
