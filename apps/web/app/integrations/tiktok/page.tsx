"use client";
import { useEffect, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
type TikTokStatus = { connected: boolean; openId?: string; scope?: string[]; accessExpiresAt?: string; refreshExpiresAt?: string; connectedAt?: string };

export default function TikTokIntegrationPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh(activeToken: string) {
    const response = await fetch(`${api}/integrations/tiktok/status`, { headers: { authorization: `Bearer ${activeToken}` } });
    if (!response.ok) throw new Error("Sessão expirada ou integração indisponível");
    setStatus(await response.json());
  }
  useEffect(() => { const saved = localStorage.getItem("atlas_token") ?? ""; setToken(saved); if (saved) void refresh(saved).catch((reason) => setError(reason.message)); }, []);
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/integrations/tiktok/connect`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.message ?? "Não foi possível iniciar a autorização");
      window.location.assign(payload.authorizationUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao conectar o TikTok"); setBusy(false); }
  }

  if (!token) return <main className="integration-login"><section className="panel"><h1>Entre primeiro no Radar de Escolhas</h1><a href="/">Voltar ao login</a></section></main>;
  return <main className="mission-shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">R</span>Radar<span className="muted"> de Escolhas</span></a><nav><a className="nav-link" href="/integrations">Hotmart</a><a className="nav-link" href="/integrations/shopee">Shopee</a><a className="nav-link active">TikTok</a><a className="nav-link" href="/distribution">Distribuição</a></nav></aside><section className="content mission-content"><header className="topbar"><div><span className="eyebrow">TIKTOK · CONECTOR OFICIAL</span><h1>Conta autorizada,<br/><em>publicação controlada.</em></h1></div></header>{error && <p className="error-banner">{error}</p>}<section className={`integration-hero ${status?.connected ? "production" : ""}`}><div><span className={`connection-dot ${status?.connected ? "online" : ""}`}/><div><small>CONTENT POSTING API</small><h2>{status?.connected ? "Conta conectada" : "Autorização necessária"}</h2><p>{status?.connected ? "Tokens criptografados · renovação automática · publicação somente após aprovação" : "Conecte a conta profissional radardeescolhas.br pelo fluxo oficial do TikTok."}</p></div></div><span className="sandbox-badge">{status?.connected ? "CONECTADO" : "PENDENTE"}</span></section><section className="integration-grid tiktok-grid"><section className="panel"><span className="eyebrow">AUTORIZAÇÃO SEGURA</span><h2>{status?.connected ? "Conexão operacional" : "Conectar conta"}</h2><p>{status?.connected ? "O Radar pode consultar o criador e preparar publicações pelos escopos concedidos." : "Você será encaminhada ao TikTok para confirmar as permissões. A senha nunca passa pelo Radar."}</p>{status?.connected && <small>Permissões: {status.scope?.join(" · ") || "não informadas"}</small>}<button className="new-button" disabled={busy} onClick={() => void connect()}>{busy ? "Abrindo TikTok…" : status?.connected ? "Renovar autorização" : "Conectar TikTok"}</button></section><section className="panel"><span className="eyebrow">PROTEÇÕES ATIVAS</span><h2>Sem credenciais no navegador</h2><p>Client Secret e refresh token permanecem protegidos no servidor. O código de autorização é temporário, de uso único e validado contra fraude.</p><p>A publicação real continua exigindo conteúdo aprovado, campanha aprovada e agendamento.</p></section></section></section></main>;
}
