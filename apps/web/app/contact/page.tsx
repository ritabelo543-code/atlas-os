import "../legal.css";

const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "contato@radardeescolhas.com.br";

export default function ContactPage() {
  return <main className="legal-shell"><article className="legal-document"><nav><a href="/">Radar de Escolhas</a><a href="/privacy">Privacidade</a><a href="/terms">Termos de uso</a></nav><span className="eyebrow">ATENDIMENTO</span><h1>Contato</h1><p>Para suporte, privacidade, exclusão de dados ou assuntos relacionados às integrações do Radar de Escolhas, escreva para:</p><p><a href={`mailto:${email}`}>{email}</a></p><p className="legal-muted">Nunca envie senhas ou tokens de acesso.</p></article></main>;
}
