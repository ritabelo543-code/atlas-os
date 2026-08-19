import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { CollectionStore } from "@atlas/core";

export type TikTokOAuthState = { state: string; ownerId: string; expiresAt: string };
export type StoredTikTokToken = {
  ownerId: string;
  openId: string;
  scope: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  connectedAt: string;
  updatedAt: string;
};
type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export class TikTokOAuthService {
  constructor(
    private readonly states: CollectionStore<TikTokOAuthState>,
    private readonly tokens: CollectionStore<StoredTikTokToken>,
    private readonly clientKey = process.env.TIKTOK_CLIENT_KEY ?? "",
    private readonly clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? "",
    private readonly redirectUri = process.env.TIKTOK_REDIRECT_URI ?? "",
    encryptionSecret = process.env.AUTH_SECRET ?? "",
    private readonly tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/",
    private readonly authorizeUrl = "https://www.tiktok.com/v2/auth/authorize/",
  ) { this.encryptionKey = createHash("sha256").update(encryptionSecret).digest(); }

  private readonly encryptionKey: Buffer;
  configured() { return Boolean(this.clientKey && this.clientSecret && this.redirectUri); }

  async begin(ownerId: string) {
    this.requireConfiguration();
    const now = Date.now();
    const state = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now + 10 * 60_000).toISOString();
    const current = (await this.states.load()).filter((item) => Date.parse(item.expiresAt) > now && item.ownerId !== ownerId);
    await this.states.save([{ state, ownerId, expiresAt }, ...current]);
    const url = new URL(this.authorizeUrl);
    url.searchParams.set("client_key", this.clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic,video.upload,video.publish");
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    return { authorizationUrl: url.toString(), expiresAt };
  }

  async complete(code: string, state: string, fetcher: typeof fetch = fetch) {
    this.requireConfiguration();
    const states = await this.states.load();
    const pending = states.find((item) => item.state === state);
    await this.states.save(states.filter((item) => item.state !== state && Date.parse(item.expiresAt) > Date.now()));
    if (!pending || Date.parse(pending.expiresAt) <= Date.now()) throw new Error("TikTok authorization state is invalid or expired");
    const payload = await this.requestToken({ client_key: this.clientKey, client_secret: this.clientSecret, code, grant_type: "authorization_code", redirect_uri: this.redirectUri }, fetcher);
    const saved = this.fromResponse(pending.ownerId, payload);
    const tokens = (await this.tokens.load()).filter((item) => item.ownerId !== pending.ownerId);
    await this.tokens.save([saved, ...tokens]);
    return this.publicStatus(saved);
  }

  async status(ownerId: string) {
    const item = (await this.tokens.load()).find((token) => token.ownerId === ownerId);
    return item ? this.publicStatus(item) : { connected: false as const };
  }

  async accessToken(ownerId: string, fetcher: typeof fetch = fetch): Promise<string> {
    const all = await this.tokens.load();
    const item = all.find((token) => token.ownerId === ownerId);
    if (!item) throw new Error("TikTok account is not connected");
    if (Date.parse(item.accessExpiresAt) > Date.now() + 10 * 60_000) return this.decrypt(item.accessToken);
    if (Date.parse(item.refreshExpiresAt) <= Date.now()) throw new Error("TikTok authorization expired; reconnect the account");
    const payload = await this.requestToken({ client_key: this.clientKey, client_secret: this.clientSecret, grant_type: "refresh_token", refresh_token: this.decrypt(item.refreshToken) }, fetcher);
    const updated = this.fromResponse(ownerId, payload, item.connectedAt);
    await this.tokens.save([updated, ...all.filter((token) => token.ownerId !== ownerId)]);
    return this.decrypt(updated.accessToken);
  }

  private requireConfiguration() { if (!this.configured()) throw new Error("TikTok OAuth requires client key, client secret and redirect URI"); }
  private async requestToken(values: Record<string, string>, fetcher: typeof fetch): Promise<TokenResponse> {
    const response = await fetcher(this.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values).toString() });
    const payload = await response.json().catch(() => ({})) as TokenResponse;
    if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token || !payload.open_id) throw new Error(`TikTok OAuth failed (${response.status}): ${payload.error_description ?? payload.error ?? "invalid token response"}`);
    return payload;
  }
  private fromResponse(ownerId: string, payload: TokenResponse, connectedAt = new Date().toISOString()): StoredTikTokToken {
    const now = Date.now();
    return { ownerId, openId: payload.open_id!, scope: payload.scope ?? "", tokenType: payload.token_type ?? "Bearer", accessToken: this.encrypt(payload.access_token!), refreshToken: this.encrypt(payload.refresh_token!), accessExpiresAt: new Date(now + (payload.expires_in ?? 86400) * 1000).toISOString(), refreshExpiresAt: new Date(now + (payload.refresh_expires_in ?? 31536000) * 1000).toISOString(), connectedAt, updatedAt: new Date(now).toISOString() };
  }
  private publicStatus(item: StoredTikTokToken) { return { connected: true as const, openId: item.openId, scope: item.scope.split(",").filter(Boolean), accessExpiresAt: item.accessExpiresAt, refreshExpiresAt: item.refreshExpiresAt, connectedAt: item.connectedAt, updatedAt: item.updatedAt }; }
  private encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join("."); }
  private decrypt(value: string) { const [version, iv, tag, encrypted] = value.split("."); if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted TikTok token"); const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url")); return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"); }
}
