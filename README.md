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
