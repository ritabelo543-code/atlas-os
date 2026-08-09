# Atlas OS — Sprint Status

## Estado atual

Atlas MVP finalizado ponta a ponta. API e Web iniciam localmente, o usuário cria uma missão na Mission Control, executa a análise, recebe uma decisão estruturada e consulta o histórico persistido. A API anterior de projetos e tarefas foi preservada.

Desde a v1.1, o Executive Agent (missões) pode usar IA real (Claude, via `AnthropicAiProvider`) quando `AI_PROVIDER=claude` e há credencial/crédito configurados; sem isso, o fallback para `MockAiProvider` é automático. A v1.2 estendeu isso a Content Studio, Market Intelligence e Learning Engine (ver detalhes no roadmap). Distribution Center, Scale Engine e Company Orchestrator permanecem deterministicamente por decisão explícita — não há tarefa de linguagem natural genuína neles, e no caso do Scale Engine a decisão alimenta diretamente ação financeira, que o handoff exige manter sob controle determinístico e aprovação humana.

## Direção oficial do produto

O Atlas OS deve operar uma empresa digital autônoma: pesquisar mercados e nichos, selecionar oportunidades e produtos, planejar e executar campanhas, produzir e distribuir conteúdo, medir conversões/ROI/lucro, aprender e escalar resultados vencedores.

A auditoria de alinhamento confirmou que Core, Event Bus, Guardian, providers, persistência, autenticação e runtimes são fundações válidas. Mission Control, Atlas Operation, Knowledge, Memory, Decision Engine, agentes, plugins, prompts e contratos de missão ainda precisam ser orientados a resultados comerciais. GitHub e agentes de TI permanecem apenas como legado auxiliar, sem prioridade no roadmap do produto.

## Sprint v0.5 — CONCLUÍDA

- Modelo comercial para pesquisas, evidências, sinais, ofertas e oportunidades, com origem e natureza do dado explícitas.
- Trend Hunter Agent e Market Research Agent executados pelo Agent Runtime, protegidos por permissões e auditados pelo Guardian.
- Motor configurado centralmente em `market-score-v1`, com dez componentes e penalidades transparentes para concorrência, esforço e risco.
- Persistência SQLite transacional e isolamento por proprietário em todos os endpoints de mercado.
- Mission Control prioriza criação de pesquisas e ranking de oportunidades; missões operacionais continuam disponíveis como suporte.
- Fluxo demonstrável usa fixtures explicitamente `simulated`; não há alegação de coleta externa real.

### Validação v0.5

- Core: 7 testes aprovados; API: 11 testes aprovados.
- Regras comerciais, pontuação, rastreabilidade, auditoria e isolamento multiusuário aprovados.
- Builds do Core, API, Web e monorepo aprovados.
- Smoke autenticado criou uma pesquisa simulada, 1 sinal, 1 oferta e 1 oportunidade, recuperou o ranking e o histórico após persistência.

## Sprint v0.6 — CONCLUÍDA

- Content Strategy, Copywriting, SEO e Content Review Agents executados pelo Agent Runtime.
- Planos editoriais vinculados obrigatoriamente a oportunidade, oferta, público, canal e etapa do funil.
- Geração de artigos, posts, e-mails, roteiros, landing pages e briefings criativos.
- Três variações transparentes de título, hook e CTA por peça, sem garantias de resultado.
- Disclosure de afiliado incorporado ao conteúdo gerado.
- Fila de revisão com aprovação ou rejeição humana antes de qualquer distribuição.
- Persistência SQLite, auditoria Guardian e isolamento multiusuário para planos e ativos.
- Content Studio disponível em `/content`; nenhuma publicação externa foi implementada.

### Validação v0.6

- Core: 7 testes aprovados; API: 12 testes aprovados.
- Build Web aprovado, incluindo a rota estática `/content`.
- Fluxo autenticado aprovado: oportunidade → plano → roteiro → revisão → aprovação.
- Geração atual é determinística (`local-content-rules`), claramente identificada; não utiliza IA externa nem produz mídia final.

## Sprint v0.7 — CONCLUÍDA EM MODO SEGURO

- Social Distribution e Traffic Tracking Agents registrados no Agent Runtime.
- Campanhas vinculadas obrigatoriamente a conteúdo aprovado e ao canal da peça.
- Fluxo controlado: rascunho → aprovação → agendamento → execução.
- Links rastreáveis com parâmetros UTM de origem, mídia, campanha e conteúdo.
- Execução `dry_run` auditada, sem postagem externa ou alegação de entrega.
- Modo `live` recusado enquanto não existir conector instalado e autorização explícita.
- Persistência SQLite, Guardian e isolamento multiusuário aplicados às campanhas.
- Distribution Center disponível em `/distribution`.

### Validação v0.7

- Core: 7 testes aprovados; API: 13 testes aprovados.
- Build integral aprovado, incluindo `/distribution`.
- Teste ponta a ponta aprovado: conteúdo não aprovado recusado; conteúdo aprovado convertido em campanha, aprovado, agendado e executado em simulação.
- UTMs, estados operacionais e isolamento entre contas confirmados.

## Sprint v0.8 — CONCLUÍDA

- Analytics e Optimization Agents adicionados ao Agent Runtime.
- Registro rastreável de impressões, cliques, conversões, custo e receita.
- Cálculo de CTR, taxa de conversão, CAC, ROI e lucro.
- Comparação de experimentos por oportunidade e recomendação de repetir ou revisar.
- Confiança e natureza dos dados preservadas em cada insight.
- Campanhas `dry_run` impedidas de registrar métricas `confirmed`.
- Persistência SQLite, auditoria Guardian e isolamento multiusuário.
- Learning Engine disponível em `/learning`.

### Validação v0.8

- Core: 7 testes aprovados; API: 13 testes aprovados.
- Build integral aprovado, incluindo `/learning`.
- Métrica confirmada em campanha simulada recusada.
- Métricas simuladas calcularam CTR 10%, conversão 10%, ROI 200% e lucro 100 no cenário de teste.
- Insight resultante permaneceu identificado como `simulated` e isolado da segunda conta.

## Sprint v0.9 — CONCLUÍDA EM MODO SEGURO

- Finance e Scale Agents adicionados ao Agent Runtime.
- Políticas com orçamento total/diário, aumento máximo, ROI mínimo, conversões mínimas e CAC máximo.
- Propostas de escala com ações `scale`, `hold` ou `stop`, justificativa e riscos.
- Aprovação humana obrigatória antes da simulação.
- Execução financeira real permanentemente desativada nesta versão.
- Dados simulados, conversões insuficientes, ROI/CAC inadequados ou orçamento zero bloqueiam escala.
- Persistência SQLite, Guardian e isolamento multiusuário.
- Scale Engine disponível em `/scale`.

### Validação v0.9

- Core: 7 testes aprovados; API: 13 testes aprovados.
- Build integral aprovado, incluindo `/scale`.
- Política segura de orçamento zero produziu `hold`, orçamento proposto zero e riscos `unconfirmed-data`/`zero-budget-policy`.
- Aprovação e execução simulada não realizaram transação financeira.

## Sprint v1.1 — PROVIDER DE IA REAL (CLAUDE NATIVO) — CONCLUÍDA

- `AnthropicAiProvider` implementado em `packages/core/src/v02.ts`, usando a Messages API nativa da Anthropic (`POST /v1/messages`, headers `x-api-key`/`anthropic-version`) em vez do protocolo OpenAI-compatible.
- `resolveAiProvider` e `apps/api/src/atlas.ts` passam a construir `AnthropicAiProvider` quando `AI_PROVIDER=claude`; `MockAiProvider` continua o padrão sem credencial.
- Timeout via `AbortController`, retry limitado a `429`/`5xx`, sem retry em `401`/`400`, e nenhuma exposição da chave em erros ou logs.
- Nova classe `AiProviderError`, usada por `AnthropicAiProvider` e `CompatibleAiProvider`; o handler de erro da API mapeia falhas do provider para `502 AI_PROVIDER_ERROR` com mensagem segura, em vez do `500 INTERNAL_ERROR` genérico anterior.
- PR: [#10](https://github.com/ritabelo543-code/atlas-os/pull/10) (draft, aguardando validação/merge).

### Validação v1.1

- Core: 12 testes aprovados (5 novos para `AnthropicAiProvider`, mock de `fetch`, sem chamada de rede). API: 20 testes aprovados (1 novo cobrindo o mapeamento para `502`).
- Build integral do monorepo aprovado.
- Validação real (fora da suíte automatizada, com credencial local): `/atlas/status` reportou `provider: anthropic`, `model: claude-sonnet-5`, `mode: live`; missão de teste executada com sucesso retornou `provider: anthropic` na decisão, com recomendação gerada pelo modelo real.
- Cenário de falha real também validado: antes da compra de créditos, a chamada real retornou `502 AI_PROVIDER_ERROR` com mensagem segura (sem vazar o corpo do erro da Anthropic nem a chave).

## Sprint v1.2 — IA REAL ESTENDIDA (CONTENT, MARKET, LEARNING) — CONCLUÍDA

- **Content Studio** ([PR #11](https://github.com/ritabelo543-code/atlas-os/pull/11)): `AiProvider.generateContent?()` opcional; `ContentStudio` usa o provider real quando `mode === "live"`, com fallback para os templates determinísticos existentes. Disclosure de afiliado sempre adicionada em código. `ContentAsset` ganhou `provider?`/`model?`.
- **Market Intelligence** ([PR #12](https://github.com/ritabelo543-code/atlas-os/pull/12)): `AiProvider.analyzeMarket?()` opcional; substitui a classificação de sinais por regex por classificação real via IA (`kind`/`direction` por evidência) e gera `rankingRationale` real. `scoreOpportunity()` (os números) permanece 100% intocado — validado por teste dedicado. `MarketResearch` ganhou `aiProvider?`/`aiModel?`.
- **Learning Engine** ([PR #13](https://github.com/ritabelo543-code/atlas-os/pull/13)): `AiProvider.summarizeInsight?()` opcional; `LearningInsight.summary` passa a ser escrito pela IA a partir das métricas reais (CTR/conversão/ROI/lucro), sem inventar números. A recomendação (repetir/revisar) — que alimenta a decisão de escala — permanece determinística. `LearningInsight` ganhou `aiProvider?`/`aiModel?`.
- Todas as três rotas (`/content/assets`, `/market/research`, `/learning/opportunities/:id/analyze`) agora repassam `AiProviderError` para o handler global (`502 AI_PROVIDER_ERROR`) em vez de mascarar como `400` genérico — mesma correção replicada 3 vezes, mesmo padrão da v1.1.
- `AnthropicAiProvider` refatorado internamente: `generate`/`generateContent`/`analyzeMarket`/`summarizeInsight` compartilham um único `callMessages()` privado (timeout, retry, parsing de erro), sem duplicar lógica de rede a cada nova capacidade.
- Bug real encontrado e corrigido durante validação ao vivo: `JSON.parse` de resposta truncada (limite de tokens insuficiente) vazava como erro cru `400` em vez de `502 AI_PROVIDER_ERROR`; corrigido com `parseJson()` centralizado e orçamento de tokens maior para conteúdo (4096 vs. 1024 de missões).
- **Decisão explícita de manter determinísticos**: Scale Engine (decisão financeira `scale/hold/stop` e orçamento — controle determinístico exigido pelo handoff), Distribution Center (mecânica de UTM/URL, sem texto livre a interpretar) e Company Orchestrator (contagens e tabela de ações fixas, sem evidência textual de entrada). Ver ROADMAP.md v1.2 para o racional completo.

### Validação v1.2

- Core: 21 testes aprovados (9 novos: `generateContent`, `analyzeMarket`, `summarizeInsight`, cada um com casos de sucesso e de resposta inválida/incompleta).
- API: 26 testes aprovados (6 novos: um par sucesso/falha-502 para cada um dos três agentes estendidos).
- Build integral do monorepo aprovado em cada incremento.
- Validação real (credencial local, créditos ativos):
  - Content Studio gerou um roteiro de vídeo completo (`generationMode: "ai"`, 3 variantes, briefing visual, disclosure presente).
  - Market Intelligence classificou corretamente evidências sem palavras-chave óbvias: migração para concorrente ("agendas de papel") como `competition`/`rising`, reclamação isolada como `noise`/`unknown`, padrão sazonal de janeiro como `seasonality`/`stable` — distinções que a regex anterior não conseguia fazer.
  - Learning Engine escreveu um resumo referenciando exatamente CTR 10%, ROI 200%, lucro 100 e CAC 5, sem inventar dados, mantendo a recomendação determinística.
- PRs: [#11](https://github.com/ritabelo543-code/atlas-os/pull/11), [#12](https://github.com/ritabelo543-code/atlas-os/pull/12), [#13](https://github.com/ritabelo543-code/atlas-os/pull/13) — todos em draft, encadeados (#10 → #11 → #12 → #13), aguardando revisão/merge em sequência.

## Sprint v1.0 — CONTROL PLANE CONCLUÍDO

- Atlas COO Agent adicionado para avaliar o ciclo empresarial completo.
- Estágios coordenados: pesquisa, conteúdo, distribuição, medição, aprendizado e escala.
- Cada avaliação identifica contagens, bloqueios e a próxima ação operacional.
- Operação humana por exceção com publicação externa e execução financeira desativadas.
- Ciclos persistidos, auditados e isolados por usuário.
- Painel empresarial disponível em `/company`.

### Validação v1.0

- Core: 7 testes aprovados; API: 13 testes aprovados.
- Build integral aprovado, incluindo `/company`.
- Avaliação reconheceu o ciclo simulado e bloqueou a etapa de medição por ausência de fonte real.
- Próxima ação recomendada: conectar fonte real e registrar métricas confirmadas.
- Flags de publicação externa e execução financeira permaneceram `false`.

## Sprint v0.4 — CONCLUÍDA

- Cadastro, login, sessão HMAC e senhas protegidas com `scrypt`.
- Isolamento de missões, decisões, memória e conhecimento por usuário.
- SQLite nativo com WAL, transações e migração automática dos JSON legados.
- Busca semântica local com vetores de termos/bigramas e similaridade de cosseno.
- Mission Control autenticada e Atlas Operation por sessão.
- Projects e Tasks protegidos integralmente por autenticação e `ownerId`, incluindo listagem, consulta, criação, edição e exclusão.
- Dados legados de Projects/Tasks sem autoria são preservados e atribuídos ao primeiro administrador.

### Validação v0.4

- Core: 5 testes aprovados; API: 10 testes aprovados.
- Testes específicos de autenticação, isolamento multiusuário, busca semântica e transações SQLite aprovados.
- Builds da API, Web e monorepo aprovados.
- Smoke real: duas contas isoladas; 2 missões para a primeira e 0 para a segunda.
- Reinício real: login, 2 missões e 2 memórias recuperados do SQLite.
- Segunda missão relacionada reutilizou 1 memória usando Mock automático.
- Web autenticada respondeu HTTP 200 com cadastro/login.
- Smoke final: proprietário recuperou Project/Task após reinício; outro usuário recebeu listas vazias e 404 em consulta, edição e exclusão.

## Sprint v0.3 — CONCLUÍDA

- Atlas Executive Agent executa o fluxo integral; a API apenas dispara a missão.
- Agent Runtime registra estado, missão atual, timeout, cancelamento, duração, memória e provider.
- Memory Manager v3 aplica decay temporal, prioridade, favoritos e referências cruzadas.
- Knowledge Engine v3 suporta namespace, projeto, categorias, busca contextual e referências internas.
- Decision Engine v3 registra alternativas comparáveis, riscos, impacto, custo, confiança ajustada e plano de execução.
- Permission Manager protege ações críticas de agentes e plugins.
- Plugin Runtime carrega, descarrega e controla versão/permissões; GitHub é o primeiro plugin real read-only.
- Atlas Operation exibe agentes, plugins, memória, eventos e performance.

### Validação v0.3

- Core: 4 testes aprovados; API: 6 testes aprovados.
- API, Web e monorepo compilados sem regressão.
- Smoke real: duas missões executadas pelo Executive Agent; a segunda reutilizou 1 memória.
- Decision v3 retornou 3 alternativas e plano com 3 etapas usando Mock automático.
- Plugin GitHub consultou 4 repositórios públicos e registrou histórico sem exigir credencial.
- Mission Control e Atlas Operation responderam HTTP 200.

## Sprint v0.2 — CONCLUÍDA

- Atlas Operation em `/operation` e endpoints para operação, logs, conhecimento, decisões, agentes, plugins e configuração segura.
- Status operacional com versão, módulos, provider, contagens, uptime e última execução.
- Providers reconhecidos: OpenAI, Claude, Gemini, DeepSeek e Ollama, com fallback automático para Mock.
- Contratos preparados para categorias, tags, relações, relevância e histórico de conhecimento; decisões preparadas para premissas, evidências, riscos e alternativas.
- Memory Manager funcional com persistência JSON, recuperação lexical entre missões, deduplicação, retenção de temporários e limite de 500 itens.
- Agent Registry e Plugin Registry permanecem como infraestrutura; autonomia e integrações reais foram movidas para v0.3+.

## Concluído

- `@atlas/core` independente de Fastify e Next.js, com lifecycle `start/stop/status`, status dos módulos e configuração observável do provider de IA.
- Event Bus tipado com `publish/subscribe` para missão, decisão e conhecimento.
- AI Provider Layer desacoplada: provider OpenAI-compatible por ambiente e provider local determinístico quando não existe chave.
- Knowledge Engine persistente com conteúdo, resumo, origem, contexto, confiança, metadados e busca simples por relevância/palavras-chave.
- Decision Engine com recuperação de contexto, uso do provider, decisão estruturada, confiança, próximos passos e resultado de dados insuficientes.
- Guardian com validação mínima de missão e audit log persistente para ações críticas.
- Persistência JSON com fila de escrita, arquivo temporário, rename atômico e backup local `.bak` antes de sobrescritas.
- Mission Control integrada, responsiva e funcional para status, criação/execução de missão, resultado e histórico recente.
- Contratos compartilhados de Atlas, missão, conhecimento, decisão e auditoria em `@atlas/types`.
- Sem segredos no código; `.env` ignorado e exemplos de ambiente para API e Web.

## Arquitetura final do MVP

- `apps/web`: interface Next.js → API HTTP.
- `apps/api`: Fastify, validação de entrada e adaptadores de persistência JSON.
- `packages/core`: lifecycle, Event Bus, providers de IA, Knowledge Engine, Decision Engine e Guardian.
- `packages/types`: contratos compartilhados entre Core, API e Web.
- `apps/api/data`: projetos, tarefas, missões, decisões, conhecimento e auditoria em arquivos locais.

O Core não depende do framework HTTP, da interface ou do armazenamento em arquivo. Os stores são injetados por contrato.

## Endpoints Atlas

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| GET | `/atlas/status` | Lifecycle, módulos e provider/modelo ativos |
| GET/POST | `/missions` | Listar e criar missões |
| GET | `/missions/:id` | Consultar missão |
| POST | `/missions/:id/execute` | Executar recuperação, análise e decisão |
| GET | `/decisions/:id` | Consultar decisão estruturada |

Os endpoints existentes de `/health`, `/projects` e `/tasks` permanecem disponíveis; Projects e Tasks exigem autenticação e aplicam isolamento por proprietário.

## Validação executada

- `pnpm install`: aprovado; lockfile validado.
- `pnpm --filter @atlas/api build`: aprovado.
- `pnpm --filter @atlas/web build`: aprovado.
- `pnpm turbo run build`: aprovado (4 tarefas).
- `pnpm --filter @atlas/core test`: 1 teste aprovado.
- `pnpm --filter @atlas/api test`: 5 testes aprovados.
- Smoke API + Web reais: API `ok`, Core `running`, Web HTTP carregada com Mission Control.
- Smoke do fluxo: duas missões relacionadas criadas e concluídas; a primeira usou 0 memórias e a segunda reutilizou 1 memória persistida, com decisão `recommendation`, confiança `0.63`, provider/modelo e histórico atualizados.
- Atlas Operation confirmou Core `running`, provider Mock efetivo, 2 memórias, contagens e auditoria persistida.

## Limitações atuais

- A busca semântica é local por termos/bigramas; embeddings, banco vetorial e RAG avançado ficam fora da v0.4.
- O provider externo espera API compatível com `/chat/completions` e resposta JSON; sem chave, o modo local mantém todo o fluxo funcional.
- SQLite é adequado para instância única; operação distribuída exigirá banco servidor, como PostgreSQL.
- Não há recuperação de senha, MFA ou autenticação federada; exposição pública exige essas camadas adicionais.
- A UI prioriza o fluxo de missão; projetos e tarefas continuam disponíveis na API, mas não são o foco da tela atual.

## Próxima etapa

Próxima etapa operacional: conectar fontes reais de mercado, programas de afiliados, publicação e analytics; somente então habilitar vendas reais sob políticas aprovadas. Recuperação de conta, MFA, PostgreSQL distribuído e observabilidade continuam requisitos antes de produção pública.
