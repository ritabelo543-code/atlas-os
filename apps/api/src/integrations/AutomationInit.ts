import { writeFileSync } from "node:fs";
import { AutomationOrchestrator, type CampaignConfig } from "./AutomationOrchestrator.js";

export async function initializeAutomation() {
  // Confirmar que a função foi chamada
  try {
    writeFileSync("./ATLAS_AUTOMATION_STARTED.txt", `✅ Automação iniciada em ${new Date().toISOString()}`);
  } catch (e) {
    // ignored
  }

  const automationEnabled = process.env.ATLAS_AUTO_PUBLISH === "true";
  const automationInterval = Number(process.env.ATLAS_LOOP_INTERVAL) || 3600000;

  if (!automationEnabled) {
    console.log("[ATLAS] Automação desativada");
    return;
  }

  console.log("[ATLAS AUTOMATION] Iniciando automação...");

  try {
    const orchestrator = new AutomationOrchestrator(
      process.env.GMAIL_USER || "",
      process.env.GMAIL_PASSWORD || "",
      process.env.INSTAGRAM_USER || "",
      process.env.INSTAGRAM_PASSWORD || "",
      process.env.TIKTOK_USER || "",
      process.env.TIKTOK_PASSWORD || ""
    );

    console.log("[ATLAS AUTOMATION] Inicializando integrações...");
    await orchestrator.initialize();
    console.log("[ATLAS AUTOMATION] ✅ Integrações inicializadas");

    const shopeeConfig: CampaignConfig = {
      name: "campanha-shopee-rita",
      market: "shopee",
      products: [{
        name: "Shopee Affiliate",
        affiliateLink: process.env.SHOPEE_AFFILIATE_ID || "1gHqPgFwr2",
        description: "Produtos selecionados com melhor preço no Shopee"
      }],
      channels: ["instagram", "tiktok", "email"],
      contentTemplate: {
        title: "Confira Produtos no Shopee",
        body: "Seleção de produtos com melhor relação preço-qualidade",
        hashtags: ["shopee", "promoção", "compras"]
      },
      targetAudience: {
        interests: ["compras", "deals"],
        emails: [process.env.GMAIL_USER || "radardeescolhas@gmail.com"]
      }
    };

    const hotmartConfig: CampaignConfig = {
      name: "campanha-hotmart-rita",
      market: "hotmart",
      products: [{
        name: "Hotmart Digital Product",
        affiliateLink: process.env.HOTMART_WEBHOOK_URL || "https://go.hotmart.com/V107180956B",
        description: "Produto digital escalável com comissão 30%"
      }],
      channels: ["instagram", "tiktok", "email"],
      contentTemplate: {
        title: "Produto Digital Rentável",
        body: "Aprenda a ganhar dinheiro com produtos digitais",
        hashtags: ["hotmart", "negócio", "renda"]
      },
      targetAudience: {
        interests: ["negócios", "empreendedorismo"],
        emails: [process.env.GMAIL_USER || "radardeescolhas@gmail.com"]
      }
    };

    orchestrator.registerCampaign(shopeeConfig);
    orchestrator.registerCampaign(hotmartConfig);
    console.log("[ATLAS AUTOMATION] ✅ Campanhas registradas");

    await orchestrator.startAutomationLoop(automationInterval);

    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║ [ATLAS AUTOMATION] ✅ SUCESSO!         ║`);
    console.log(`║ Loop iniciado a cada ${automationInterval / 1000 / 60} minutos       ║`);
    console.log(`║ Campanhas: Shopee + Hotmart           ║`);
    console.log(`╚════════════════════════════════════════╝\n`);

    writeFileSync("./ATLAS_AUTOMATION_SUCCESS.txt", `✅ Loop automático iniciado com sucesso em ${new Date().toISOString()}\nProxima execução em ${automationInterval / 1000 / 60} minutos\nCampanhas: Shopee + Hotmart`);

  } catch (error) {
    console.error("[ATLAS AUTOMATION] ❌ ERRO:", error);
    try {
      writeFileSync("./ATLAS_AUTOMATION_ERROR.txt", `❌ Erro: ${String(error)}\n${error instanceof Error ? error.stack : ""}`);
    } catch (e) {
      // ignored
    }
  }
}
