export type InstagramPublishResult = { externalId: string; containerId: string; delivered: true };

export class InstagramGraphClient {
  constructor(
    private readonly accountId = process.env.INSTAGRAM_ACCOUNT_ID ?? "",
    private readonly accessToken = process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
    private readonly version = process.env.INSTAGRAM_API_VERSION ?? "v23.0",
    private readonly baseUrl = "https://graph.facebook.com",
    private readonly processing = { attempts: 10, intervalMs: 2_000 },
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  status() { return { configured: Boolean(this.accountId && this.accessToken), accountIdConfigured: Boolean(this.accountId), version: this.version }; }

  async verify(fetcher: typeof fetch = fetch) {
    this.requireConfiguration();
    const payload = await this.request<{ id?: string; username?: string; account_type?: string }>(`/${this.accountId}?fields=id,username,account_type`, undefined, fetcher);
    if (!payload.id) throw new Error("Instagram Graph API returned no account id");
    return { authenticated: true, id: payload.id, username: payload.username, accountType: payload.account_type };
  }

  async publishImage(imageUrl: string, caption: string, fetcher: typeof fetch = fetch): Promise<InstagramPublishResult> {
    this.requireConfiguration();
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") throw new Error("Instagram requires a publicly reachable HTTPS image URL");
    const container = await this.request<{ id?: string }>(`/${this.accountId}/media`, { image_url: imageUrl, caption }, fetcher);
    if (!container.id) throw new Error("Instagram did not return a media container id");
    await this.waitForContainer(container.id, fetcher);
    const published = await this.request<{ id?: string }>(`/${this.accountId}/media_publish`, { creation_id: container.id }, fetcher);
    if (!published.id) throw new Error("Instagram did not return a published media id");
    return { externalId: published.id, containerId: container.id, delivered: true };
  }

  private requireConfiguration() { if (!this.accountId || !this.accessToken) throw new Error("Instagram Graph API requires INSTAGRAM_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN"); }

  private async waitForContainer(containerId: string, fetcher: typeof fetch): Promise<void> {
    for (let attempt = 1; attempt <= this.processing.attempts; attempt += 1) {
      const state = await this.request<{ status_code?: string }>(`/${containerId}?fields=status_code`, undefined, fetcher);
      const status = state.status_code ?? "unknown";
      if (status === "FINISHED") return;
      if (status === "ERROR" || status === "EXPIRED") throw new Error(`Instagram media container failed: ${status}`);
      if (attempt < this.processing.attempts) await this.sleep(this.processing.intervalMs);
    }
    throw new Error("Instagram media container was not ready before the processing timeout");
  }

  private async request<T>(path: string, body: Record<string, string> | undefined, fetcher: typeof fetch): Promise<T> {
    const url = `${this.baseUrl}/${this.version}${path}`;
    const response = await fetcher(url, body ? { method: "POST", headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${this.accessToken}` } });
    const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
    if (!response.ok) throw new Error(`Instagram Graph API failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
    return payload;
  }
}
