export type GeneratedImage = { bytes: Buffer; model: string; mimeType: "image/png"; revisedPrompt?: string; requestId?: string };

export class OpenAIImageClient {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY ?? "",
    readonly model = process.env.IMAGE_MODEL ?? "gpt-image-1-mini",
    private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  ) {}

  status() { return { configured: Boolean(this.apiKey), model: this.model }; }

  async generate(prompt: string, fetcher: typeof fetch = fetch): Promise<GeneratedImage> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not configured");
    if (!prompt.trim()) throw new Error("Image prompt is required");
    const response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: prompt.trim(), size: "1024x1024", quality: "low", n: 1 }),
    });
    const payload = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string; revised_prompt?: string }>; error?: { message?: string } };
    if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
    const image = payload.data?.[0];
    if (!image?.b64_json) throw new Error("OpenAI image generation returned no image data");
    return { bytes: Buffer.from(image.b64_json, "base64"), model: this.model, mimeType: "image/png", ...(image.revised_prompt ? { revisedPrompt: image.revised_prompt } : {}), ...(response.headers.get("x-request-id") ? { requestId: response.headers.get("x-request-id")! } : {}) };
  }
}
