import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3333);

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
