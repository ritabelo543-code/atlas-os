import { readFile, stat } from "node:fs/promises";

const required = [
  ["infrastructure/Dockerfile", ["AS api", "AS web", "USER node"]],
  ["infrastructure/compose.production.yml", ["atlas-data:/data", "service_healthy", "ATLAS_PUBLIC_URL"]],
  ["apps/web/next.config.mjs", ["output: \"standalone\""]],
  [".dockerignore", [".env", "apps/api/data"]],
  ["scripts/check-production-readiness.mjs", ["AUTH_SECRET", "ATLAS_PUBLIC_URL"]],
];

for (const [file, patterns] of required) {
  const contents = await readFile(file, "utf8");
  for (const pattern of patterns) if (!contents.includes(pattern)) throw new Error(`${file} is missing required production rule: ${pattern}`);
}

const standalone = "apps/web/.next/standalone/apps/web/server.js";
try { await stat(standalone); console.log(`Infrastructure OK; standalone server found at ${standalone}`); }
catch { console.log("Infrastructure files OK; run pnpm build to produce the standalone Web server."); }
