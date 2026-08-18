const checks = [];
const add = (name, ready, detail) => checks.push({ name, ready, detail });
const value = (name) => process.env[name]?.trim() ?? "";
const httpsUrl = (name) => { try { return new URL(value(name)).protocol === "https:"; } catch { return false; } };

add("public API HTTPS", httpsUrl("ATLAS_PUBLIC_URL"), "ATLAS_PUBLIC_URL must be a public HTTPS URL");
add("Web CORS origin HTTPS", httpsUrl("CORS_ORIGIN"), "CORS_ORIGIN must be the public Web HTTPS origin");
add("authentication secret", value("AUTH_SECRET").length >= 32, "AUTH_SECRET must contain at least 32 characters");
add("live AI", value("AI_PROVIDER") !== "mock" && Boolean(value("AI_API_KEY") && value("AI_MODEL")), "AI provider, model and key are required");
add("image generation", Boolean(value("OPENAI_API_KEY")), "OPENAI_API_KEY is required for real media");
add("Hotmart production", Boolean(value("HOTMART_CLIENT_ID") && value("HOTMART_CLIENT_SECRET")), "Hotmart client credentials are required");
add("automatic financial scaling disabled", value("ATLAS_AUTO_SCALE") !== "true", "Keep real financial scaling disabled until confirmed conversion data and budget approval exist");

const social = [
  { name: "Instagram OAuth", ready: Boolean(value("INSTAGRAM_ACCOUNT_ID") && value("INSTAGRAM_ACCESS_TOKEN")), detail: "Instagram professional account id and OAuth token" },
  { name: "TikTok OAuth", ready: Boolean(value("TIKTOK_ACCESS_TOKEN")), detail: "TikTok user OAuth token with approved publishing scope" },
];
for (const item of social) checks.push(item);

for (const check of checks) console.log(`${check.ready ? "READY" : "MISSING"}  ${check.name} — ${check.detail}`);
const core = checks.filter((item) => !["Instagram OAuth", "TikTok OAuth"].includes(item.name));
const requireSocial = process.argv.includes("--require-social");
const successful = core.every((item) => item.ready) && (!requireSocial || social.some((item) => item.ready));
console.log(successful ? "\nAtlas production core is ready." : "\nAtlas production readiness failed.");
process.exitCode = successful ? 0 : 1;
