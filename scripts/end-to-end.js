const API = process.env.ATLAS_API_URL ?? "http://localhost:3333";
let token = "";

async function call(path, method = "GET", body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function run() {
  console.log("ATLAS END-TO-END LOCAL");
  const health = await call("/health");
  if (health.status !== "ok") throw new Error("API health check failed");

  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const auth = await call("/auth/register", "POST", {
    email: `e2e-${unique}@atlas.local`,
    password: "Atlas-e2e-123!",
    name: "Atlas E2E",
  });
  token = auth.token;

  const research = await call("/market/research", "POST", {
    query: "organização doméstica",
    market: "Afiliados",
    niche: "organização doméstica",
    audience: "pessoas que querem organizar a casa",
    painOrDesire: "economizar espaço e tempo",
    channels: ["instagram"],
    evidence: [{ source: "e2e:local", observedAt: new Date().toISOString(), excerpt: "Evidência local para validar o funcionamento técnico", valueKind: "simulated", confidence: 0.7 }],
    offers: [{ name: "Oferta E2E", provider: "fixture", notes: "Validação local" }],
    metrics: { demand: 70, commercialIntent: 70, competition: 50, monetization: 65, margin: 60, effort: 40, risk: 30, evidenceQuality: 60, confidence: 65, scalability: 70 },
    dataKind: "simulated",
  });
  if (!research.opportunities?.length) throw new Error("Research produced no opportunity");

  const ranking = await call("/market/opportunities");
  if (!ranking.some((item) => item.id === research.opportunities[0].id)) throw new Error("Persisted opportunity was not returned");
  console.log("E2E OK: health, authentication, research and persistence");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
