"use client";
import { type FormEvent, useEffect, useState } from "react";
import type { ContentAsset, DistributionCampaign, DistributionMode } from "@atlas/types";
import "../mission.css";
import "./distribution.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
type Readiness = { integrations: { instagramPublishing: { ready: boolean; state: string }; tiktokPublishing: { ready: boolean; state: string } } };

export default function DistributionPage() {
  const [token, setToken] = useState("");
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [campaigns, setCampaigns] = useState<DistributionCampaign[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [assetId, setAssetId] = useState("");
  const [destination, setDestination] = useState("Canal principal");
  const [targetUrl, setTargetUrl] = useState("https://example.com/oferta");
  const [campaignName, setCampaignName] = useState("Campanha Radar de Escolhas");
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [mode, setMode] = useState<DistributionMode>("dry_run");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const headers = (json = false) => ({ authorization: `Bearer ${token}`, ...(json ? { "content-type": "application/json" } : {}) });

  async function refresh(activeToken = token) {
    const auth = { authorization: `Bearer ${activeToken}` };
    const responses = await Promise.all([fetch(`${api}/content/assets`, { headers: auth }), fetch(`${api}/distribution/campaigns`, { headers: auth }), fetch(`${api}/atlas/readiness`, { headers: auth })]);
    if (responses.some((item) => !item.ok)) throw new Error("Sessão expirada ou API indisponível");
    const nextAssets = (await responses[0].json() as ContentAsset[]).filter((item) => item.status === "approved");
    setAssets(nextAssets); setCampaigns(await responses[1].json()); setReadiness(await responses[2].json()); setAssetId((value) => value || nextAssets[0]?.id || "");
  }

  useEffect(() => { const saved = localStorage.getItem("atlas_token") ?? ""; setToken(saved); if (saved) void refresh(saved).catch((reason) => setError(reason.message)); }, []);
  const selected = assets.find((item) => item.id === assetId);
  const liveReady = selected?.channel === "instagram" ? readiness?.integrations.instagramPublishing.ready : selected?.channel === "tiktok" ? readiness?.integrations.tiktokPublishing.ready : false;

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (!selected) throw new Error("Selecione um conteúdo aprovado"); if (mode === "live" && !liveReady) throw new Error("O conector oficial deste canal ainda não está pronto"); const response = await fetch(`${api}/distribution/campaigns`, { method: "POST", headers: headers(true), body: JSON.stringify({ assetId, channel: selected.channel, destination, scheduledAt: new Date(scheduledAt).toISOString(), targetUrl, campaignName, mode }) }); if (!response.ok) throw new Error((await response.json()).message); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar campanha"); }
    finally { setBusy(false); }
  }

  async function advance(campaign: DistributionCampaign) {
    setBusy(true); setError("");
    try { const action = campaign.status === "draft" ? "approve" : campaign.status === "approved" ? "schedule" : campaign.status === "scheduled" ? "execute" : ""; if (!action) return; const response = await fetch(`${api}/distribution/campaigns/${campaign.id}/${action}`, { method: "POST", headers: headers() }); if (!response.ok) throw new Error((await response.json()).message); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao avançar campanha"); }
    finally { setBusy(false); }
  }

  if (!token) return <main className="distribution-page"><section className="panel"><h1>Entre primeiro no Radar de Escolhas</h1><a href="/">Voltar ao login</a></section></main>;
  return <main className="mission-shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">R</span>Radar<span className="muted"> de Escolhas</span></a><nav><a className="nav-link" href="/">Oportunidades</a><a className="nav-link" href="/content">Conteúdo</a><a className="nav-link active">Distribuição</a></nav></aside><section className="content mission-content"><header className="topbar"><div><span className="eyebrow">DISTRIBUTION CENTER · OFFICIAL CONNECTORS</span><h1>Conteúdo aprovado,<br/><em>publicação verificável.</em></h1></div></header>{error && <p className="error-banner">{error}</p>}<section className="distribution-grid"><form className="panel mission-form" onSubmit={create}><h2>Preparar distribuição</h2><label>Conteúdo aprovado<select value={assetId} onChange={(event) => { setAssetId(event.target.value); setMode("dry_run"); }} required><option value="">Selecione</option>{assets.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.channel}</option>)}</select></label><label>Modo<select value={mode} onChange={(event) => setMode(event.target.value as DistributionMode)}><option value="dry_run">Validação sem publicação</option>{liveReady && <option value="live">Publicação real pelo conector oficial</option>}</select></label><small>{liveReady ? "Conector oficial pronto. Publicação real ainda exige aprovação e agendamento." : "Publicação real bloqueada até token OAuth e URL pública HTTPS estarem prontos."}</small><label>Destino<input value={destination} onChange={(event) => setDestination(event.target.value)} required/></label><label>URL da oferta<input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required/></label><label>Nome da campanha<input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} required/></label><label>Agendamento<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required/></label><button className="new-button" disabled={busy || !assetId}>Criar campanha</button></form><section className="panel"><h2>Campanhas</h2>{campaigns.length === 0 && <p className="empty-state">Nenhuma campanha preparada.</p>}{campaigns.map((campaign) => <article className="distribution-card" key={campaign.id}><span className={`mission-status ${campaign.status === "completed" ? "completed" : ""}`}>{campaign.status}</span><h3>{campaign.utm.campaign}</h3><p>{campaign.channel} · {campaign.destination} · {campaign.mode}</p><a href={campaign.trackingUrl} target="_blank" rel="noreferrer">Link rastreável</a>{campaign.externalId && <small>ID externo: {campaign.externalId}</small>}{campaign.result && <p>{campaign.result.detail}</p>}{["draft", "approved", "scheduled"].includes(campaign.status) && <button className="new-button" disabled={busy} onClick={() => void advance(campaign)}>{campaign.status === "draft" ? "Aprovar" : campaign.status === "approved" ? "Agendar" : campaign.mode === "live" ? "Publicar agora" : "Executar validação"}</button>}</article>)}</section></section></section></main>;
}
