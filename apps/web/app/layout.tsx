import type { Metadata } from "next";
import "./globals.css";
import "./projects.css";
import "./tasks.css";
import "./mission.css";
import "./market.css";
import "./operation/operation.css";
import "./shortcut.css";

export const metadata: Metadata = {
  title: "Atlas OS",
  description: "Pesquisa de mercado, oportunidades e conteúdo comercial automatizado.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<a className="content-shortcut" href="/content">Conteúdo</a><a className="distribution-shortcut" href="/distribution">Distribuição · v0.7</a></body></html>;
}
