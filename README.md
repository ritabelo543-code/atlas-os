# Atlas OS

Atlas OS é o sistema operacional de uma empresa digital automatizada. Ele pesquisa oportunidades, escolhe produtos e estratégias, coordena execução, marketing e conteúdo, mede resultados, aprende com desempenho e escala iniciativas lucrativas.

O Mission Control, os agentes, Knowledge, Memory, Decision Engine, Guardian e plugins existem para fortalecer o ciclo comercial: mercado → pesquisa → oportunidade → planejamento → execução → distribuição → medição → aprendizado → otimização → escala → lucro.

## Executar localmente

Requisitos: Node.js 20+ e pnpm 11+.

```sh
pnpm install
pnpm dev
```

Abra `http://localhost:3000`. A API usa `http://localhost:3333` por padrão.

Sem configuração adicional, o Atlas usa o provider Mock determinístico. Para ativar OpenAI, defina `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL` e opcionalmente `AI_BASE_URL` no ambiente do processo da API. Use `apps/api/.env.example` como referência e nunca versione chaves. Se a chave não existir, o fallback para Mock é automático e todo o fluxo continua funcional.

Para apontar a Web para outra API, copie `apps/web/.env.example` para `apps/web/.env.local` e altere `NEXT_PUBLIC_API_URL`.

## Atlas v0.5 — Pesquisa de Mercado Inteligente

Após entrar, a tela principal permite registrar mercado, nicho, público, dor/desejo, fonte, evidência e uma oferta opcional. O Trend Hunter classifica sinais sem confundir toda popularidade com tendência; o Market Research Agent estrutura oportunidades e o motor `market-score-v1` compara demanda, intenção comercial, concorrência, monetização, margem, esforço, risco, qualidade das evidências, confiança e escala.

O ranking mostra a composição e a justificativa. Dados `confirmed`, `estimated`, `calculated` e `simulated` permanecem explicitamente diferenciados. A v0.5 não consulta a internet por conta própria: fontes e métricas vêm da entrada autenticada ou de fixtures de teste, e nenhuma integração simulada é apresentada como real.

Endpoints autenticados:

- `POST /market/research`: executa a pesquisa e gera sinais, ofertas e oportunidades.
- `GET /market/research`: recupera o histórico do usuário.
- `GET /market/evidence`, `/market/signals` e `/market/offers`: recuperam fontes, sinais e produtos candidatos rastreáveis.
- `GET /market/opportunities`: lista o ranking do usuário.
- `GET /market/opportunities/:id`: recupera uma oportunidade sem vazar dados entre contas.

As coleções `market_research`, `market_evidence`, `market_signals`, `market_offers` e `market_opportunities` são persistidas transacionalmente no mesmo SQLite. O Guardian registra autor, entradas principais, fontes, resultado, duração e versão da lógica.

## Conteúdo automatizado v0.6

O Content Studio em `http://localhost:3000/content` transforma uma oportunidade do ranking em plano editorial e peças comerciais revisáveis. A geração atual é local e determinística, cria variações de título/hook/CTA, disclosure de afiliado e briefings visuais, e nunca publica automaticamente.

- `POST/GET /content/plans`: cria e lista planos editoriais do usuário.
- `POST/GET /content/assets`: gera e lista peças comerciais.
- `GET /content/assets/:id`: recupera uma peça com isolamento por proprietário.
- `PATCH /content/assets/:id/review`: aprova ou rejeita uma peça antes da distribuição.

As coleções `content_plans` e `content_assets` são persistidas no SQLite e auditadas pelo Guardian.

## Distribuição automática v0.7

O Distribution Center em `http://localhost:3000/distribution` prepara campanhas somente a partir de conteúdo aprovado. O fluxo inclui aprovação, agendamento, UTMs e execução simulada. Nenhuma postagem externa ocorre na configuração atual.

- `POST/GET /distribution/campaigns`: cria e lista campanhas.
- `GET /distribution/campaigns/:id`: consulta uma campanha isolada por proprietário.
- `POST /distribution/campaigns/:id/approve`: registra aprovação humana.
- `POST /distribution/campaigns/:id/schedule`: agenda uma campanha aprovada.
- `POST /distribution/campaigns/:id/execute`: executa o `dry_run` auditado.

O modo `live` é recusado até existir um conector real do canal e autorização explícita.

## Atlas v0.4

O painel interno fica em `http://localhost:3000/operation`. Na base atual ele consolida Core, Executive Agent, execuções, memória, eventos, performance, decisões e plugins. As próximas versões devem substituir a ênfase técnica por oportunidades, campanhas, produtos, conteúdo, conversões, ROI, lucro, alertas e resultados.

Providers reconhecidos: `mock`, `openai`, `claude`, `gemini`, `deepseek` e `ollama`. A v0.2 usa o protocolo OpenAI-compatible; Claude nativo exige um gateway compatível. O provider e o modelo efetivamente usados aparecem na decisão e na auditoria, sem exposição da chave.

Cada missão concluída gera memória persistente no SQLite com origem, missão, resumo, conteúdo, confiança, relevância, tags e timestamps. Missões posteriores recuperam registros relacionados por busca semântica local. O sistema evita conteúdo idêntico, remove memórias temporárias expiradas e mantém no máximo 500 itens.

### Fluxos

- Agente: API dispara a missão → Agent Runtime aplica timeout/cancelamento → Executive Agent valida permissão, recupera Knowledge e Memory, chama o provider, cria a decisão, audita e persiste o resultado.
- Memória: relevância lexical + decay temporal + prioridade/favorito → referências cruzadas entre as memórias usadas e a nova memória.
- Decisão: recomendação → alternativas comparáveis por impacto, custo, risco e confiança → plano de execução.
- Plugins: Permission Manager valida capacidades → Plugin Runtime carrega/descarrega versões → plugin GitHub consulta repositórios, PRs e issues e registra histórico.

O plugin GitHub é preservado apenas como ferramenta auxiliar de desenvolvimento e não integra a prioridade comercial do produto. As integrações futuras devem priorizar pesquisa de mercado, afiliados, conteúdo, distribuição, anúncios e analytics.

### Autenticação e multiusuário

A primeira conta criada recebe papel `admin`; as seguintes recebem `member`. Senhas são derivadas com `scrypt`, nunca armazenadas em texto, e as sessões usam tokens HMAC com validade de 24 horas. Defina `AUTH_SECRET` em ambientes compartilhados. Missões, decisões, memórias, conhecimento, projetos e tarefas são filtrados pelo proprietário autenticado.

### Persistência transacional

O armazenamento padrão é SQLite nativo em `apps/api/data/atlas.db`, com WAL e transações `BEGIN IMMEDIATE/COMMIT/ROLLBACK`. Na primeira inicialização, os JSON legados são importados automaticamente; os arquivos originais permanecem intactos. Projects e Tasks antigos sem proprietário são atribuídos ao primeiro administrador existente ou criado, pois o formato legado não registra autoria.

### Busca semântica local

O Knowledge Engine cria vetores locais de termos e bigramas normalizados e ordena resultados por similaridade de cosseno e confiança. Não requer embeddings externos, credenciais ou banco vetorial.

## Validar

```sh
pnpm --filter @atlas/core test
pnpm --filter @atlas/api test
pnpm --filter @atlas/api build
pnpm --filter @atlas/web build
pnpm turbo run build
```

Os dados locais ficam em `apps/api/data/atlas.db`. `ATLAS_DATA_DIR` ou `ATLAS_DATABASE_PATH` permitem usar outro destino, inclusive para testes isolados.
