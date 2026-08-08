import type { Metadata } from "next";
import "./globals.css";
import "./projects.css";
import "./tasks.css";
import "./mission.css";
import "./market.css";
import "./operation/operation.css";

export const metadata: Metadata = {
  title: "Atlas OS",
  description: "Pesquisa de mercado e oportunidades comerciais estruturadas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
