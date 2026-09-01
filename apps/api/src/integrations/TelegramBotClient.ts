type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };
type TelegramMessage = { message_id: number; chat: { id: number | string } };

export class TelegramBotClient {
  constructor(private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim(), private readonly request: typeof fetch = fetch) {}
  status() { return { configured: Boolean(this.token), provider: "telegram-bot-api", capabilities: ["message", "photo", "inline-link"] }; }
  async verify(): Promise<{ id: number; username?: string }> { return this.call("getMe", {}); }
  async sendOffer(input: { chatId: string; text: string; link: string; imageUrl?: string; buttonText?: string }): Promise<{ externalId: string }> {
    if (!input.chatId.trim() || !input.text.trim()) throw new Error("Telegram destination and message are required");
    const url = new URL(input.link); if (url.protocol !== "https:") throw new Error("Telegram offer link must use HTTPS");
    const reply_markup = { inline_keyboard: [[{ text: input.buttonText?.trim() || "Ver oferta", url: url.toString() }]] };
    const result = input.imageUrl
      ? await this.call<TelegramMessage>("sendPhoto", { chat_id: input.chatId, photo: input.imageUrl, caption: input.text.slice(0, 1024), reply_markup })
      : await this.call<TelegramMessage>("sendMessage", { chat_id: input.chatId, text: input.text.slice(0, 4096), disable_web_page_preview: false, reply_markup });
    return { externalId: `${result.chat.id}:${result.message_id}` };
  }
  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    if (!this.token) throw new Error("Telegram Bot API token is not configured");
    const response = await this.request(`https://api.telegram.org/bot${this.token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const parsed = await response.json() as TelegramResponse<T>;
    if (!response.ok || !parsed.ok || !parsed.result) throw new Error(`Telegram API failed (${response.status}): ${parsed.description ?? "unknown error"}`);
    return parsed.result;
  }
}
