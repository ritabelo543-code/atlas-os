export type ShopeeChannel = "instagram" | "tiktok" | "pinterest";
export type ShopeeAffiliateLink = { id: string; ownerId: string; name: string; category: string; channel: ShopeeChannel; affiliateUrl: string; subId: string; status: "active"; dataKind: "confirmed"; source: "shopee-affiliate"; createdAt: string };

export function validateShopeeAffiliateUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Informe um link válido da Shopee"); }
  if (url.protocol !== "https:" || !/(^|\.)(shopee\.com\.br|shope\.ee|shp\.ee)$/i.test(url.hostname)) throw new Error("O link precisa pertencer à Shopee");
  return url.toString();
}

export function createShopeeLink(ownerId: string, input: { name: string; category: string; channel: ShopeeChannel; affiliateUrl: string; subId?: string }): ShopeeAffiliateLink {
  if (!input.name.trim() || !input.category.trim()) throw new Error("Nome e categoria são obrigatórios");
  if (!(["instagram", "tiktok", "pinterest"] as string[]).includes(input.channel)) throw new Error("Canal inválido");
  return { id: crypto.randomUUID(), ownerId, name: input.name.trim(), category: input.category.trim(), channel: input.channel, affiliateUrl: validateShopeeAffiliateUrl(input.affiliateUrl), subId: input.subId?.trim() ?? "", status: "active", dataKind: "confirmed", source: "shopee-affiliate", createdAt: new Date().toISOString() };
}
