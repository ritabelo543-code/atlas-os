import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type HotmartCredentials = { clientId: string; clientSecret: string; basic: string };
export type HotmartEnvironment = "sandbox" | "production";
export type HotmartConnectionStatus = { configured: boolean; environment: HotmartEnvironment; authenticated: boolean; expiresIn?: number };
export type HotmartPage<T> = { items: T[]; page_info?: { next_page_token?: string | null; prev_page_token?: string | null; results_per_page?: number } };
export type HotmartProduct = { id: number; name: string; ucode: string; status: string; created_at?: number; format?: string; is_subscription?: boolean; warranty_period?: number };
export type HotmartOffer = { code: string; name?: string; description?: string; payment_mode?: string; is_main_offer?: boolean; price?: { value?: number; currency_code?: string } };
export type HotmartSale = { product?: { id?: number; name?: string }; purchase?: { transaction?: string; status?: string; commission_as?: string; approved_date?: number; order_date?: number; price?: { value?: number; currency_code?: string } } };

const defaultCredentialPath = (environment: HotmartEnvironment) => fileURLToPath(new URL(`../../.secrets/hotmart-${environment}.txt`, import.meta.url));

export class HotmartClient {
  private authenticated = false;
  private expiresIn?: number;

  constructor(private readonly credentials: HotmartCredentials | null, readonly environment: HotmartEnvironment = "sandbox") {}

  static fromEnvironment(environment: HotmartEnvironment = "sandbox"): HotmartClient {
    const prefix = `HOTMART_${environment.toUpperCase()}_`;
    const clientId = process.env[`${prefix}CLIENT_ID`] ?? (environment === "production" ? process.env.HOTMART_CLIENT_ID : undefined);
    const clientSecret = process.env[`${prefix}CLIENT_SECRET`] ?? (environment === "production" ? process.env.HOTMART_CLIENT_SECRET : undefined);
    const basic = process.env[`${prefix}BASIC`] ?? (environment === "production" ? process.env.HOTMART_BASIC : undefined);
    if (!clientId || !clientSecret) return HotmartClient.fromLocalFile(environment);
    return new HotmartClient({ clientId, clientSecret, basic: basic?.replace(/^Basic\s+/i, "") ?? Buffer.from(`${clientId}:${clientSecret}`).toString("base64") }, environment);
  }

  static fromLocalFile(environment: HotmartEnvironment = "sandbox", path = process.env[`HOTMART_${environment.toUpperCase()}_CREDENTIALS_FILE`] ?? defaultCredentialPath(environment)): HotmartClient {
    if (!existsSync(path)) return new HotmartClient(null, environment);
    return new HotmartClient(parseHotmartCredentials(readFileSync(path, "utf8")), environment);
  }

  status(): HotmartConnectionStatus {
    return { configured: Boolean(this.credentials), environment: this.environment, authenticated: this.authenticated, ...(this.expiresIn === undefined ? {} : { expiresIn: this.expiresIn }) };
  }

  async verifyAuthentication(fetcher: typeof fetch = fetch): Promise<HotmartConnectionStatus> {
    await this.accessToken(fetcher);
    return this.status();
  }

  async listProducts(fetcher: typeof fetch = fetch): Promise<HotmartProduct[]> {
    return (await this.getPage<HotmartProduct>(`${this.apiBase()}/products/api/v1/products?max_results=50`, fetcher)).items;
  }

  async listOffers(ucode: string, fetcher: typeof fetch = fetch): Promise<HotmartOffer[]> {
    try { return (await this.getPage<HotmartOffer>(`${this.apiBase()}/products/api/v1/products/${encodeURIComponent(ucode)}/offers?max_results=50`, fetcher)).items; }
    catch (error) { if (error instanceof HotmartRequestError && error.status === 404) return []; throw error; }
  }

  async listAffiliateSales(fetcher: typeof fetch = fetch): Promise<HotmartSale[]> {
    return (await this.getPage<HotmartSale>(`${this.apiBase()}/payments/api/v1/sales/history?max_results=100&commission_as=AFFILIATE`, fetcher)).items;
  }

  private async getPage<T>(url: string, fetcher: typeof fetch): Promise<HotmartPage<T>> {
    const token = await this.accessToken(fetcher);
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!response.ok) throw new HotmartRequestError(response.status);
    const payload = await response.json() as HotmartPage<T>;
    return { items: Array.isArray(payload.items) ? payload.items : [], page_info: payload.page_info };
  }

  private async accessToken(fetcher: typeof fetch): Promise<string> {
    if (!this.credentials) throw new Error(`Hotmart ${this.environment} credentials are not configured`);
    const query = new URLSearchParams({ grant_type: "client_credentials", client_id: this.credentials.clientId, client_secret: this.credentials.clientSecret });
    const response = await fetcher(`https://api-sec-vlc.hotmart.com/security/oauth/token?${query}`, { method: "POST", headers: { Authorization: `Basic ${this.credentials.basic}`, "Content-Type": "application/json" } });
    if (!response.ok) throw new Error(`Hotmart authentication failed with status ${response.status}`);
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Hotmart authentication returned no access token");
    this.authenticated = true;
    this.expiresIn = payload.expires_in;
    return payload.access_token;
  }

  private apiBase(): string { return this.environment === "sandbox" ? "https://sandbox.hotmart.com" : "https://developers.hotmart.com"; }
}

class HotmartRequestError extends Error {
  constructor(readonly status: number) { super(`Hotmart request failed with status ${status}`); }
}

export function parseHotmartCredentials(contents: string): HotmartCredentials {
  const values = new Map<string, string>();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(Client ID|Client Secret|Basic)\s*:\s*(.+?)\s*$/i);
    if (match) values.set(match[1]!.toLowerCase(), match[2]!);
  }
  const clientId = values.get("client id"), clientSecret = values.get("client secret"), basic = values.get("basic");
  if (!clientId || !clientSecret || !basic) throw new Error("Invalid Hotmart credential file");
  return { clientId, clientSecret, basic: basic.replace(/^Basic\s+/i, "") };
}
