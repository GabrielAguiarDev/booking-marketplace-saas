import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const title = "Vez — Horário vazio não volta atrás";
const description =
  "Agendamento para barbearias, salões, clínicas de estética e petshops. O cliente vê o horário livre e marca sozinho, sem você parar o atendimento para responder mensagem.";

export const metadata: Metadata = {
  title,
  description,
  // O cartão de quem compartilha o link no WhatsApp, que é por onde a landing circula.
  openGraph: { title, description, type: "website", locale: "pt_BR", siteName: "Vez" },
};

// Sem JavaScript o `Reveal` não roda e tudo que tem `data-reveal` ficaria
// invisível: este estilo só vale nesse caso.
const NO_SCRIPT_STYLE = "[data-reveal]{opacity:1!important;transform:none!important}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: NO_SCRIPT_STYLE }} />
        </noscript>
        {children}
      </body>
    </html>
  );
}
