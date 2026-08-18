export type HotmartAffiliateLink = { id: string; ownerId: string; name: string; affiliateUrl: string; subId: string; status: "active"; dataKind: "confirmed"; source: "hotmart-affiliate"; createdAt: string };
export type HotmartClick = { id: string; linkId: string; ownerId: string; subId: string; occurredAt: string; dataKind: "confirmed"; source: "atlas-redirect" };

export function validateHotmartAffiliateUrl(value: string) {
  let url: URL; try { url = new URL(value); } catch { throw new Error("Informe um link válido da Hotmart"); }
  if (url.protocol !== "https:" || !/(^|\.)(go\.hotmart\.com|hotmart\.com)$/i.test(url.hostname)) throw new Error("O link precisa pertencer à Hotmart");
  return url.toString();
}

export function createHotmartLink(ownerId: string, input: { name: string; affiliateUrl: string; subId?: string }): HotmartAffiliateLink {
  if (!input.name?.trim()) throw new Error("Nome é obrigatório");
  return { id: crypto.randomUUID(), ownerId, name: input.name.trim(), affiliateUrl: validateHotmartAffiliateUrl(input.affiliateUrl), subId: input.subId?.trim() ?? "", status: "active", dataKind: "confirmed", source: "hotmart-affiliate", createdAt: new Date().toISOString() };
}
