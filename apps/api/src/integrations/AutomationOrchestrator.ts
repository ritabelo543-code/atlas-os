import { GmailIntegration } from "./GmailIntegration.js";
import { InstagramIntegration } from "./InstagramIntegration.js";
import { TikTokIntegration } from "./TikTokIntegration.js";

export interface AutomationTask {
  id: string;
  type: "research" | "content-create" | "publish" | "track" | "scale";
  status: "pending" | "running" | "completed" | "failed";
  data: any;
  createdAt: Date;
  completedAt?: Date;
}

export interface CampaignConfig {
  name: string;
  market: "hotmart" | "shopee" | "both";
  products: Array<{
    name: string;
    affiliateLink: string;
    description: string;
  }>;
  channels: ("email" | "instagram" | "tiktok")[];
  contentTemplate: {
    title: string;
    body: string;
    hashtags: string[];
  };
  targetAudience: {
    emails?: string[];
    interests: string[];
  };
  budget?: number;
}

export class AutomationOrchestrator {
  private gmail: GmailIntegration;
  private instagram: InstagramIntegration;
  private tiktok: TikTokIntegration;
  private tasks: Map<string, AutomationTask> = new Map();
  private campaigns: Map<string, CampaignConfig> = new Map();

  constructor(
    gmailUser: string,
    gmailPass: string,
    instagramUser: string,
    instagramPass: string,
    tiktokUser: string,
    tiktokPass: string
  ) {
    this.gmail = new GmailIntegration(gmailUser, gmailPass);
    this.instagram = new InstagramIntegration(instagramUser, instagramPass);
    this.tiktok = new TikTokIntegration(tiktokUser, tiktokPass);
  }

  async initialize(): Promise<void> {
    console.log("[Automação] Inicializando integrações...");

    const instagramLogin = await this.instagram.login();
    const tiktokLogin = await this.tiktok.login();

    if (!instagramLogin.success) throw new Error("Instagram login failed");
    if (!tiktokLogin.success) throw new Error("TikTok login failed");

    console.log("[Automação] ✅ Todas as integrações ativas");
  }

  registerCampaign(config: CampaignConfig): void {
    this.campaigns.set(config.name, config);
    console.log(`[Campanha] Registrada: ${config.name}`);
  }

  async executeCampaign(campaignName: string): Promise<{
    success: boolean;
    tasksExecuted: number;
    results: any[];
  }> {
    const campaign = this.campaigns.get(campaignName);
    if (!campaign) throw new Error(`Campaign ${campaignName} not found`);

    console.log(`\n🚀 EXECUTANDO CAMPANHA: ${campaignName}`);
    console.log("=".repeat(50));

    const results: any[] = [];

    // 1. Email Marketing
    if (campaign.channels.includes("email") && campaign.targetAudience.emails) {
      console.log("\n📧 [FASE 1] Enviando emails...");
      for (const email of campaign.targetAudience.emails) {
        const result = await this.gmail.sendCampaignEmail(
          [email],
          campaign.contentTemplate.title,
          campaign.contentTemplate.body,
          campaign.products[0].affiliateLink
        );
        results.push({ channel: "email", email, ...result });
        console.log(`   ✅ Email enviado para ${email}`);
      }
    }

    // 2. Instagram
    if (campaign.channels.includes("instagram")) {
      console.log("\n📸 [FASE 2] Publicando no Instagram...");
      for (const product of campaign.products) {
        const result = await this.instagram.uploadPost(
          "https://placeholder.com/1080x1350.jpg",
          `${campaign.contentTemplate.body}\n\n${product.description}`,
          campaign.contentTemplate.hashtags,
          product.affiliateLink
        );
        results.push({ channel: "instagram", product: product.name, ...result });
        console.log(`   ✅ Post criado: ${product.name}`);
      }
    }

    // 3. TikTok
    if (campaign.channels.includes("tiktok")) {
      console.log("\n🎵 [FASE 3] Publicando no TikTok...");
      const result = await this.tiktok.uploadShort(
        "https://placeholder.com/video.mp4",
        campaign.contentTemplate.body,
        "trending-sound-2024"
      );
      results.push({ channel: "tiktok", ...result });
      console.log(`   ✅ Short criado`);
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ CAMPANHA CONCLUÍDA: ${results.length} ações executadas`);
    console.log("=".repeat(50) + "\n");

    return {
      success: true,
      tasksExecuted: results.length,
      results,
    };
  }

  async startAutomationLoop(interval: number = 3600000): Promise<void> {
    console.log(`[Loop] Iniciando automação a cada ${interval / 1000 / 60} minutos`);

    setInterval(async () => {
      console.log(`\n⏰ [${new Date().toISOString()}] Executando ciclo de automação...`);

      for (const [campaignName] of this.campaigns) {
        try {
          await this.executeCampaign(campaignName);
        } catch (error) {
          console.error(`❌ Erro na campanha ${campaignName}:`, error);
        }
      }
    }, interval);
  }

  getStatus(): {
    campaigns: number;
    tasks: number;
    integrations: string[];
  } {
    return {
      campaigns: this.campaigns.size,
      tasks: this.tasks.size,
      integrations: ["Gmail", "Instagram", "TikTok"],
    };
  }
}
