# Atlas OS

Atlas OS é um Mission Control local: recebe uma missão, recupera conhecimento relevante, gera uma decisão estruturada e mantém o histórico e a auditoria do fluxo.

## Executar localmente

Requisitos: Node.js 20+ e pnpm 11+.

```sh
pnpm install
pnpm dev
```

Abra `http://localhost:3000`. A API usa `http://localhost:3333` por padrão.

Sem configuração adicional, o Atlas usa o provider Mock determinístico. Para ativar OpenAI, defina `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL` e opcionalmente `AI_BASE_URL` no ambiente do processo da API. Use `apps/api/.env.example` como referência e nunca versione chaves. Se a chave não existir, o fallback para Mock é automático e todo o fluxo continua funcional.

Para apontar a Web para outra API, copie `apps/web/.env.example` para `apps/web/.env.local` e altere `NEXT_PUBLIC_API_URL`.

## Atlas v0.3

O painel interno fica em `http://localhost:3000/operation`. Ele consolida Core, Executive Agent, execuções, memória, eventos, performance, decisões e plugins.

Providers reconhecidos: `mock`, `openai`, `claude`, `gemini`, `deepseek` e `ollama`. A v0.2 usa o protocolo OpenAI-compatible; Claude nativo exige um gateway compatível. O provider e o modelo efetivamente usados aparecem na decisão e na auditoria, sem exposição da chave.

Cada missão concluída gera uma memória persistente em JSON com origem, missão, resumo, conteúdo, confiança, relevância, tags e timestamps. Missões posteriores recuperam registros relacionados por busca lexical. O MVP evita conteúdo idêntico, remove memórias temporárias expiradas e mantém no máximo 500 itens; as gravações preservam a escrita atômica e o backup `.bak`.

### Fluxos

- Agente: API dispara a missão → Agent Runtime aplica timeout/cancelamento → Executive Agent valida permissão, recupera Knowledge e Memory, chama o provider, cria a decisão, audita e persiste o resultado.
- Memória: relevância lexical + decay temporal + prioridade/favorito → referências cruzadas entre as memórias usadas e a nova memória.
- Decisão: recomendação → alternativas comparáveis por impacto, custo, risco e confiança → plano de execução.
- Plugins: Permission Manager valida capacidades → Plugin Runtime carrega/descarrega versões → plugin GitHub consulta repositórios, PRs e issues e registra histórico.

O plugin GitHub opera em leitura para dados públicos sem credencial. Defina `GITHUB_TOKEN` apenas para repositórios privados ou maior limite de API; sua ausência não bloqueia o Atlas.

## Validar

```sh
pnpm --filter @atlas/core test
pnpm --filter @atlas/api test
pnpm --filter @atlas/api build
pnpm --filter @atlas/web build
pnpm turbo run build
```

Os dados locais ficam em `apps/api/data`. Cada sobrescrita válida mantém uma cópia anterior com extensão `.bak`. `ATLAS_DATA_DIR` permite usar outro diretório, inclusive para testes isolados.
