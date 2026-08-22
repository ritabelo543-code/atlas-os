import type { Metadata } from "next";
import "./escolhas.css";
import "./cover.css";

export const metadata: Metadata = {
  title: "Escolhas do Radar | Radar de Escolhas",
  description: "Produtos e cursos selecionados pelo Radar de Escolhas.",
};

const products = [
  {
    category: "Beleza e profissão",
    title: "Alongamento de Unhas em Fibras",
    description:
      "Aprenda a preparação, a aplicação e a finalização de unhas em fibra com acabamento profissional.",
    cta: "Conhecer o curso",
    href: "https://atlasapi-production-c60b.up.railway.app/r/campaign/1d9f85fe-9dca-4629-ac32-59a87d453113",
    featured: true,
  },
];

export default function EscolhasPage() {
  return (
    <main className="choices-page">
      <header className="choices-header">
        <a className="choices-brand" href="/escolhas" aria-label="Radar de Escolhas">
          <span>R</span>
          <strong>Radar de Escolhas</strong>
        </a>
        <p>Escolhas pesquisadas para facilitar a sua decisão.</p>
      </header>

      <section className="choices-hero">
        <span className="choices-eyebrow">DESTAQUES DO RADAR</span>
        <h1>Boas escolhas começam com <em>boas informações.</em></h1>
        <p>Conheça produtos e cursos selecionados para você.</p>
      </section>

      <section className="choices-list" aria-label="Produtos recomendados">
        {products.map((product) => (
          <article className="choice-card" key={product.title}>
            <div className="choice-visual">
              <img
                src="/products/alongamento-unhas-fibras.png"
                alt="Curso de Alongamento de Unhas em Fibras"
              />
            </div>
            <div className="choice-copy">
              <span className="choice-category">{product.category}</span>
              <h2>{product.title}</h2>
              <p>{product.description}</p>
              <a className="choice-button" href={product.href} rel="sponsored noopener noreferrer">
                {product.cta} <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>
        ))}
      </section>

      <section className="choices-next">
        <span aria-hidden="true">＋</span>
        <div>
          <strong>Novas escolhas em breve</strong>
          <p>Produtos de beleza, casa, cursos e outras descobertas serão adicionados aqui.</p>
        </div>
      </section>

      <footer className="choices-footer">
        <strong>Radar de Escolhas</strong>
        <span>Pesquisamos. Comparamos. Você escolhe.</span>
      </footer>
    </main>
  );
}
