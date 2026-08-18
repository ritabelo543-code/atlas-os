export type TikTokCreatorInfo = { creatorUsername?: string; privacyLevels: string[] };

export class TikTokContentClient {
  constructor(private readonly accessToken = process.env.TIKTOK_ACCESS_TOKEN ?? "", private readonly baseUrl = "https://open.tiktokapis.com") {}
  status() { return { configured: Boolean(this.accessToken) }; }

  async creatorInfo(fetcher: typeof fetch = fetch): Promise<TikTokCreatorInfo> {
    this.requireConfiguration();
    const payload = await this.post<{ data?: { creator_username?: string; privacy_level_options?: string[] }; error?: { code?: string; message?: string } }>("/v2/post/publish/creator_info/query/", {}, fetcher);
    return { creatorUsername: payload.data?.creator_username, privacyLevels: payload.data?.privacy_level_options ?? [] };
  }

  async publishPhoto(imageUrls: string[], title: string, description: string, privacyLevel: string, fetcher: typeof fetch = fetch) {
    this.requireConfiguration();
    if (!imageUrls.length || imageUrls.some((value) => new URL(value).protocol !== "https:")) throw new Error("TikTok requires HTTPS photo URLs from a verified domain");
    const creator = await this.creatorInfo(fetcher);
    if (!creator.privacyLevels.includes(privacyLevel)) throw new Error("Selected TikTok privacy level is not allowed for this creator");
    const payload = await this.post<{ data?: { publish_id?: string }; error?: { code?: string; message?: string } }>("/v2/post/publish/content/init/", { post_info: { title, description, privacy_level: privacyLevel, disable_comment: false, auto_add_music: true }, source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: imageUrls }, post_mode: "DIRECT_POST", media_type: "PHOTO" }, fetcher);
    if (!payload.data?.publish_id) throw new Error("TikTok did not return a publish id");
    return { externalId: payload.data.publish_id, delivered: true as const };
  }

  private requireConfiguration() { if (!this.accessToken) throw new Error("TikTok Content Posting API requires TIKTOK_ACCESS_TOKEN"); }
  private async post<T>(path: string, body: unknown, fetcher: typeof fetch): Promise<T> { const response = await fetcher(`${this.baseUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } }; if (!response.ok || (payload.error?.code && payload.error.code !== "ok")) throw new Error(`TikTok Content Posting API failed (${response.status}): ${payload.error?.message ?? payload.error?.code ?? "unknown error"}`); return payload; }
}
