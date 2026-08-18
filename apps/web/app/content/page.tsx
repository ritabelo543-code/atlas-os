"use client";
import { type FormEvent, useEffect, useState } from "react";
import type { ContentAsset, ContentChannel, ContentFormat, ContentPlan, MarketOpportunity } from "@atlas/types";
import "../mission.css";
import "./content.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
type MediaAsset = { id: string; contentAssetId: string; model: string; url: string; createdAt: string };

export default function ContentPage() {
  const [token, setToken] = useState("");
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opportunityId, setOpportunityId] = useState("");
  const [objective, setObjective] = useState("Apresentar a oferta com transparência e gerar interesse qualificado");
  const [channels, setChannels] = useState("instagram");
  const [keywords, setKeywords] = useState("");
  const [planId, setPlanId] = useState("");
  const [channel, setChannel] = useState<ContentChannel>("instagram");
  const [format, setFormat] = useState<ContentFormat>("social-post");
  const [instructions, setInstructions] = useState("");
  const headers = (json = false, activeToken = token) => ({ authorization: `Bearer ${activeToken}`, ...(json ? { "content-type": "application/json" } : {}) });

  async function refresh(activeToken = token) {
    const paths = ["market/opportunities", "content/plans", "content/assets", "content/media"];
    const responses = await Promise.all(paths.map((path) => fetch(`${api}/${path}`, { headers: headers(false, activeToken) })));
    if (responses.some((item) => !item.ok)) throw new Error("Sessão expirada ou API indisponível");
    const [nextOpportunities, nextPlans, nextAssets, nextMedia] = await Promise.all(responses.map((item) => item.json()));
    setOpportunities(nextOpportunities); setPlans(nextPlans); setAssets(nextAssets); setMedia(nextMedia);
    setOpportunityId((value) => value || nextOpportunities[0]?.id || ""); setPlanId((value) => value || nextPlans[0]?.id || "");
  }

  useEffect(() => { const saved = localStorage.getItem("atlas_token") ?? ""; setToken(saved); if (saved) void refresh(saved).catch((reason) => setError(reason.message)); }, []);
  async function request(path: string, method: string, body: unknown) { const response = await fetch(`${api}/${path}`, { method, headers: headers(true), body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.message ?? "Operação não concluída"); return payload; }

  async function createPlan(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const plan = await request("content/plans", "POST", { opportunityId, objective, funnelStage: "conversion", channels: channels.split(",").map((item) => item.trim()).filter(Boolean), keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean), tone: "claro e confiável" }) as ContentPlan; setPlanId(plan.id); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar plano"); } finally { setBusy(false); } }
  async function generate(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await request("content/assets", "POST", { planId, channel, format, instructions }); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao gerar conteúdo"); } finally { setBusy(false); } }
  async function review(id: string, status: "approved" | "rejected") { setBusy(true); setError(""); try { await request(`content/assets/${id}/review`, "PATCH", { status, notes: status === "approved" ? "Aprovado no Mission Control" : "Requer revisão" }); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na revisão"); } finally { setBusy(false); } }
  async function generateImage(id: string) { setBusy(true); setError(""); try { await request(`content/assets/${id}/image`, "POST", {}); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao gerar imagem"); } finally { setBusy(false); } }

  if (!token) return <main className="content-page"><section className="panel"><h1>Entre primeiro no Radar de Escolhas</h1><a href="/">Voltar ao login</a></section></main>;
  return <main className="mission-shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">R</span>Radar<span className="muted"> de Escolhas</span></a><nav><a className="nav-link" href="/">Oportunidades</a><a className="nav-link active">Conteúdo</a><a className="nav-link" href="/distribution">Distribuição</a></nav></aside><section className="content mission-content"><header className="topbar"><div><span className="eyebrow">CONTENT STUDIO · REAL MEDIA</span><h1>Conteúdo aprovado,<br/><em>mídia publicável.</em></h1></div></header>{error && <p className="error-banner">{error}</p>}<section className="content-metrics"><article><strong>{plans.length}</strong><span>planos</span></article><article><strong>{assets.length}</strong><span>peças</span></article><article><strong>{media.length}</strong><span>imagens reais</span></article></section><section className="content-grid"><form className="panel mission-form" onSubmit={createPlan}><h2>Novo plano</h2><label>Oportunidade<select value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)} required><option value="">Selecione</option>{opportunities.map((item) => <option key={item.id} value={item.id}>{item.niche} · {item.score}</option>)}</select></label><label>Objetivo<textarea value={objective} onChange={(event) => setObjective(event.target.value)} required/></label><label>Canais<input value={channels} onChange={(event) => setChannels(event.target.value)} /></label><label>Palavras-chave<input value={keywords} onChange={(event) => setKeywords(event.target.value)} /></label><button className="new-button" disabled={busy || !opportunityId}>Criar plano</button></form><form className="panel mission-form" onSubmit={generate}><h2>Gerar texto</h2><label>Plano<select value={planId} onChange={(event) => setPlanId(event.target.value)} required><option value="">Selecione</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.objective}</option>)}</select></label><label>Canal<select value={channel} onChange={(event) => setChannel(event.target.value as ContentChannel)}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="blog">Blog</option><option value="email">E-mail</option><option value="youtube">YouTube</option><option value="landing-page">Landing page</option></select></label><label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as ContentFormat)}><option value="social-post">Post social</option><option value="article">Artigo</option><option value="email">E-mail</option><option value="video-script">Roteiro de vídeo</option><option value="landing-page">Landing page</option><option value="creative-brief">Briefing criativo</option></select></label><label>Orientação<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label><button className="new-button" disabled={busy || !planId}>Gerar conteúdo</button></form></section><section className="asset-list"><h2>Fila de conteúdo</h2>{!assets.length && <p className="empty-state">Crie um plano e gere a primeira peça.</p>}{assets.map((asset) => { const images = media.filter((item) => item.contentAssetId === asset.id); return <article className="panel asset" key={asset.id}><div><span className={`mission-status ${asset.status === "approved" ? "completed" : asset.status === "rejected" ? "failed" : ""}`}>{asset.status}</span><h3>{asset.title}</h3><small>{asset.channel} · {asset.format} · {asset.generationMode}</small></div><p>{asset.body}</p>{asset.designBrief && <p><strong>Briefing visual:</strong> {asset.designBrief}</p>}{asset.status === "in_review" && <div className="review-actions"><button className="new-button" disabled={busy} onClick={() => void review(asset.id, "approved")}>Aprovar</button><button disabled={busy} onClick={() => void review(asset.id, "rejected")}>Rejeitar</button></div>}{asset.status === "approved" && !images.length && <div><button className="new-button" disabled={busy} onClick={() => void generateImage(asset.id)}>Gerar imagem real</button><small>Esta ação usa a API de imagens configurada e pode gerar cobrança.</small></div>}{images.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer">Abrir imagem · {image.model}</a>)}</article>; })}</section></section></main>;
}
