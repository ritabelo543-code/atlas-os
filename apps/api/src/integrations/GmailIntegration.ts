import nodemailer from "nodemailer";

export class GmailIntegration {
  private transporter: nodemailer.Transporter;

  constructor(email: string, password: string) {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: email,
        pass: password,
      },
    });
  }

  async sendCampaignEmail(
    to: string[],
    subject: string,
    html: string,
    affiliateLink: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const htmlWithLink = html.replace(/\{affiliate_link\}/g, affiliateLink);
      const result = await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to.join(","),
        subject,
        html: htmlWithLink,
        replyTo: process.env.GMAIL_USER,
      });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendPromotionalSequence(
    recipient: string,
    campaignName: string,
    products: Array<{ name: string; link: string }>,
    dayInterval: number = 1
  ): Promise<void> {
    const emailSequence = [
      {
        subject: `🎯 ${campaignName} - Descoberta exclusiva`,
        body: `Olá! Encontramos um produto perfeito para você: ${products[0]?.name}`,
      },
      {
        subject: `⏰ Última chance: ${campaignName}`,
        body: `Você ainda tem acesso à oferta. Confira: ${products[0]?.link}`,
      },
      {
        subject: `🚀 Bônus especial: ${campaignName}`,
        body: `Só para quem viu este email primeiro, confira o desconto extra!`,
      },
    ];

    for (let i = 0; i < emailSequence.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, dayInterval * 24 * 60 * 60 * 1000));
      await this.sendCampaignEmail(
        [recipient],
        emailSequence[i].subject,
        emailSequence[i].body,
        products[0]?.link || ""
      );
    }
  }
}
