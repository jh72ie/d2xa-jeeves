// Calls the v0 Model API (OpenAI Chat Completions-compatible) to generate HTML.
// We instruct the model to return ONLY a self-contained HTML snippet (no code fences).
type GenerateOptions = {
  token?: string;        // override API key
  endpoint?: string;     // override API endpoint
  model?: string;        // override model id
  timeoutMs?: number;    // request timeout
  temperature?: number;  // sampling temperature
};

export async function generateHtmlWithV0({
  prompt,
  data,
  options = {},
}: {
  prompt: string;
  data?: unknown;
  options?: GenerateOptions;
}): Promise<{ html: string; raw: unknown }> {
  const token =
    options.token ??
    process.env.V0_API_TOKEN ?? // backwards compat
    process.env.V0_API_KEY;     // current name in docs

  if (!token) {
    throw new Error("V0_API_TOKEN/V0_API_KEY is not set.");
  }

  const endpoint =
    options.endpoint ??
    process.env.V0_API_ENDPOINT ??
    "https://api.v0.dev/v1/chat/completions";

  const model =
    options.model ??
    process.env.V0_MODEL ??
    "v0-1.5-md";

  const timeoutMs = options.timeoutMs ?? 60_000;
  const temperature = options.temperature ?? 0.2;

  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);

  // Strongly instruct the model to return only HTML (no code fences, no markdown).
  const systemPrompt =
    "You are an HTML UI generator. Respond with ONLY a valid, self-contained HTML snippet that represents a single card component. " +
    "Do not include code fences, markdown, explanations, or scripts. Use inline CSS only. Avoid external links, fonts, or JS.";

  const userPrompt = [
    "Create a minimal, self-contained HTML card. Requirements:",
    "- No <script> tags; inline CSS only",
    "- No external resources",
    "- Return ONLY HTML (no markdown, no code fences)",
    "",
    "Description:",
    prompt,
    "",
    data ? `Optional data (JSON):\n${safeStringify(data)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = {
    model,
    // We’re not using streaming here; we need the final HTML string
    stream: false,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await safeReadText(res);
      console.error("V0 API HTTP error", {
        endpoint,
        status: res.status,
        statusText: res.statusText,
        responseBody: truncate(text, 2000),
        requestBodyPreview: truncate(JSON.stringify(body), 1000),
      });
      throw new Error(
        `v0 API error: ${res.status} ${res.statusText} - ${truncate(text, 2000)}`
      );
    }

    const json = (await res.json()) as any;

    // OpenAI-compatible shape
    // { choices: [{ message: { role: 'assistant', content: '...html...' } }], ... }
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      console.error("V0 API unexpected payload (missing assistant.content string)", {
        endpoint,
        payload: truncate(JSON.stringify(json), 2000),
      });
      throw new Error(
        "v0 API response missing assistant message content string."
      );
    }

    const html = stripCodeFences(content).trim();
    if (!html || !looksLikeHtml(html)) {
      console.error("V0 API returned content that does not look like HTML", {
        preview: truncate(html, 500),
      });
      throw new Error("v0 API returned non-HTML content.");
    }

    return { html, raw: json };
  } finally {
    clearTimeout(abortId);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function stripCodeFences(s: string): string {
  // Remove ```html ... ``` or ``` ... ``` fences if present
  return s.replace(/^```(\w+)?\s*[\r\n]?/, "").replace(/```$/m, "");
}

function looksLikeHtml(s: string): boolean {
  // Very light heuristic to avoid accidental plain text
  return /<\s*(div|section|article|main|header|footer|html|body)\b/i.test(s);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + " …[truncated]" : s;
}
