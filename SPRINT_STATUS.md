# Atlas OS — Sprint Status

## Estado atual

Atlas MVP finalizado ponta a ponta. API e Web iniciam localmente, o usuário cria uma missão na Mission Control, executa a análise, recebe uma decisão estruturada e consulta o histórico persistido. A API anterior de projetos e tarefas foi preservada.

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

Os endpoints existentes de `/health`, `/projects` e `/tasks` permanecem disponíveis.

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

- A busca de conhecimento é lexical; embeddings, banco vetorial e RAG avançado ficam fora do MVP.
- O provider externo espera API compatível com `/chat/completions` e resposta JSON; sem chave, o modo local mantém todo o fluxo funcional.
- JSON local é adequado para uso individual e baixo volume, não para múltiplas instâncias concorrentes.
- Não há autenticação/autorização; a implantação pública exige essa camada antes de exposição.
- A UI prioriza o fluxo de missão; projetos e tarefas continuam disponíveis na API, mas não são o foco da tela atual.

## Próxima etapa pós-MVP

Adicionar autenticação, migrar persistência crítica para banco transacional, disponibilizar cadastro de conhecimento na UI, evoluir busca semântica e adicionar observabilidade/avaliações dos providers antes de produção multiusuário.
