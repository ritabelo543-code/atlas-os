import type { Metadata } from "next";
import "./globals.css";
import "./projects.css";
import "./tasks.css";
import "./mission.css";
import "./market.css";
import "./operation/operation.css";
import "./shortcut.css";
import "./integrations/integrations.css";
import "./offers/offers.css";

export const metadata: Metadata = {
  title: "Radar de Escolhas",
  description: "Pesquisa de oportunidades, curadoria de produtos e conteúdo comercial responsável.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<a className="offers-shortcut" href="/offers">Ofertas 2.0</a><a className="content-shortcut" href="/content">Conteúdo</a><a className="distribution-shortcut" href="/distribution">Distribuição</a><a className="learning-shortcut" href="/learning">Aprendizado</a><a className="scale-shortcut" href="/scale">Escala</a><a className="company-shortcut" href="/company">Empresa · v1.0</a><a className="integration-shortcut" href="/integrations">Hotmart</a><a className="shopee-shortcut" href="/integrations/shopee">Shopee</a><a className="tiktok-shortcut" href="/integrations/tiktok">TikTok</a></body></html>;
}
