\# HANDOFF OFICIAL — ATLAS OS



Leia este documento integralmente antes de analisar, planejar ou alterar o projeto.



\## 1. Regra absoluta de isolamento



O Atlas OS é um projeto completamente independente.



Não misture ao Atlas:



\- biblioteca inteligente;

\- gestão documental corporativa;

\- políticas, procedimentos ou documentos internos;

\- outros projetos da usuária;

\- requisitos obtidos de outras conversas;

\- arquiteturas ou roadmaps externos ao repositório.



Use como fonte de verdade:



1\. este documento;

2\. o repositório `atlas-os`;

3\. os arquivos `README.md`, `ROADMAP.md` e `SPRINT\_STATUS.md`;

4\. as decisões confirmadas pela usuária nesta conversa.



Se encontrar divergência entre código, documentação e missão comercial, informe claramente antes de alterar o produto.



\---



\## 2. Missão oficial do Atlas



O Atlas OS é o sistema operacional de uma empresa digital inteligente e progressivamente autônoma.



O objetivo comercial é vender produtos digitais e físicos como afiliado, inicialmente por meio de:



\- Hotmart;

\- Shopee.



Os canais iniciais de marketing são:



\- Pinterest;

\- Instagram;

\- TikTok.



A marca comercial criada para a operação é:



\*\*Radar de Escolhas\*\*



As contas das redes sociais foram criadas separadamente das contas pessoais da usuária. O Atlas não deve criar dependência pública da identidade pessoal dela.



O ciclo operacional oficial é:



\*\*mercado → pesquisa → oportunidade → produto → planejamento → conteúdo → distribuição → medição → aprendizado → otimização → escala → lucro\*\*



Toda funcionalidade precisa demonstrar como contribui para pelo menos um destes objetivos:



\- gerar receita;

\- descobrir oportunidades comerciais;

\- produzir ou distribuir conteúdo;

\- medir resultados;

\- aprender com dados reais;

\- automatizar a empresa;

\- reduzir risco operacional.



\---



\## 3. Objetivo final



O resultado desejado é uma empresa capaz de:



1\. pesquisar mercados e tendências;

2\. identificar dores, desejos, nichos e públicos;

3\. encontrar produtos reais de afiliados;

4\. analisar demanda, concorrência, comissão, preço, risco e potencial;

5\. selecionar os produtos mais promissores;

6\. definir estratégia, canal e público;

7\. criar textos, imagens e vídeos;

8\. preparar campanhas;

9\. publicar nos canais autorizados;

10\. acompanhar cliques, conversões, vendas, custos e receita;

11\. aprender com os resultados;

12\. interromper campanhas ruins;

13\. melhorar campanhas promissoras;

14\. propor escala dentro de limites financeiros;

15\. manter auditoria de todas as decisões e execuções.



Autonomia não significa ausência de controle. Publicações externas, gastos, mudanças de orçamento e outras ações sensíveis devem possuir limites, auditoria, aprovação e mecanismo de interrupção.



\---



\## 4. Repositório



GitHub:



`https://github.com/ritabelo543-code/atlas-os`



Repositório local principal:



`C:\\Users\\ritad\\Documents\\Codex\\2026-08-07\\referenced-chatgpt-conversation-this-is-an\\atlas-os`



Branch oficial:



`develop`



Última integração confirmada:



\- PR #9 — integrações comerciais Hotmart e Shopee;

\- mergeada em `develop`;

\- commit observado após sincronização: `883f5f8`.



Antes de trabalhar:



```powershell

cd "C:\\Users\\ritad\\Documents\\Codex\\2026-08-07\\referenced-chatgpt-conversation-this-is-an\\atlas-os"

git status -sb

git pull --ff-only origin develop

pnpm.cmd install

pnpm.cmd test

pnpm.cmd build

```



Não apague nem versiona arquivos locais pertencentes à usuária.



\---



\## 5. Arquivos locais que não devem ser enviados



Estes arquivos e diretórios devem continuar fora de commits:



\- `apps/api/data/atlas.db`

\- `apps/api/data/atlas.db-shm`

\- `apps/api/data/atlas.db-wal`

\- `apps/api/data/atlas.db.secret`

\- `apps/api/src.zip`

\- `work/`

\- qualquer arquivo dentro de `.secrets/`

\- credenciais baixadas;

\- tokens;

\- senhas;

\- arquivos temporários;

\- bancos locais;

\- dados pessoais.



O `.gitignore` protege:



```text

.secrets/

\*\*/.secrets/

```



Nunca revele, registre em logs, copie para documentação ou envie ao GitHub:



\- client ID;

\- client secret;

\- tokens;

\- senhas;

\- telefone;

\- e-mails particulares;

\- credenciais das plataformas;

\- dados pessoais de compradores.



\---



\## 6. Estado atual real do Atlas



A aplicação está operacional localmente, mas a inteligência artificial real ainda não está ativada.



Diagnóstico confirmado:



```text

provider: atlas-dev

model: deterministic-v1

mode: mock

AI\_PROVIDER: não configurado

AI\_MODEL: não configurado

AI\_API\_KEY: não configurada

AI\_BASE\_URL: não configurada

```



Portanto:



> O Atlas possui infraestrutura de IA, agentes e automação, mas atualmente executa grande parte do comportamento usando regras determinísticas, mocks e simulações.



Não afirmar que o Atlas já é uma empresa autônoma.



\---



\## 7. Componentes implementados



\### Fundações



\- Atlas Core;

\- Event Bus;

\- Guardian;

\- auditoria;

\- autenticação;

\- permissões;

\- isolamento multiusuário;

\- SQLite;

\- API;

\- contratos compartilhados;

\- Agent Runtime;

\- Plugin Runtime;

\- memória;

\- Knowledge Engine;

\- Decision Engine;

\- Mission Control;

\- interface web.



\### Inteligência comercial



\- Market Research Agent;

\- Trend Hunter Agent;

\- pesquisas persistidas;

\- evidências;

\- sinais;

\- ofertas;

\- oportunidades;

\- ranking comercial com critérios transparentes;

\- distinção entre dados confirmados, estimados, calculados e simulados.



\### Conteúdo



\- planos editoriais;

\- geração de peças;

\- variações de títulos e chamadas;

\- briefing visual;

\- estados de revisão, aprovação e rejeição.



Entretanto, a geração atual usa principalmente:



```text

generationMode: deterministic

provider: local-content-rules

```



Ela ainda não representa conteúdo produzido por um LLM real.



\### Distribuição



\- preparação de campanhas;

\- rastreamento;

\- aprovação;

\- agendamento;

\- execução em modo de teste.



Limitação atual:



```text

mode: dry\_run

provider: local-distribution-simulator

delivered: false

```



Não existe publicação real conectada às redes sociais.



\### Aprendizado



\- registro de desempenho;

\- insights;

\- memória;

\- propostas de otimização.



Limitação atual:



\- boa parte das métricas é inserida manualmente;

\- a interface ainda registra dados simulados;

\- não existe captura automática completa de métricas sociais e comerciais.



\### Escala



\- políticas financeiras;

\- propostas;

\- aprovação;

\- simulação.



Limitação atual:



\- execução financeira real está desativada;

\- propostas são simuladas;

\- não há aumento automático de orçamento.



\### Orquestração



Existe um `CompanyOrchestrator`, mas ele avalia o estado das etapas usando regras locais.



Configuração atual:



```text

mode: safe

externalPublishingEnabled: false

financialExecutionEnabled: false

provider: atlas-company-rules

```



Ele identifica bloqueios e sugere a próxima ação, mas ainda não executa sozinho o ciclo completo da empresa.



\---



\## 8. Integração Hotmart



Foram criadas credenciais de sandbox e produção.



Elas estão armazenadas somente em arquivos locais protegidos:



```text

apps/api/.secrets/hotmart-sandbox.txt

apps/api/.secrets/hotmart-production.txt

```



Nunca leia ou exponha os valores em respostas, logs ou commits.



Foi implementado:



\- autenticação OAuth;

\- ambiente sandbox;

\- ambiente de produção;

\- consulta de produtos;

\- consulta de ofertas;

\- consulta de vendas como afiliado;

\- persistência por usuário;

\- separação entre dados simulados e confirmados;

\- ausência de armazenamento de informações pessoais do comprador.



Rotas:



```text

GET  /integrations/hotmart/status

POST /integrations/hotmart/verify

POST /integrations/hotmart/sync

GET  /integrations/hotmart/products

GET  /integrations/hotmart/offers

GET  /integrations/hotmart/sales

```



Validação anteriormente observada:



```text

Sandbox:

17 produtos

0 ofertas

2 vendas de afiliado



Produção:

1 produto

1 oferta

0 vendas de afiliado

```



Esses números podem mudar e devem ser consultados novamente antes de qualquer decisão.



A sincronização ainda precisa ser acionada. Não existe um processo contínuo completamente autônomo.



\---



\## 9. Integração Shopee



A Shopee utiliza atualmente um fluxo manual e seguro.



O link é criado no Portal de Afiliados da Shopee e cadastrado no Atlas.



Foi implementado:



```text

GET    /integrations/shopee/links

POST   /integrations/shopee/links

DELETE /integrations/shopee/links/:id

```



Dados registrados:



\- nome do produto;

\- categoria;

\- canal;

\- link de afiliado;

\- Sub\_id;

\- proprietário;

\- origem;

\- data;

\- classificação como dado confirmado.



A integração não acessa senha da Shopee e não usa API privada não autorizada.



O produto "Jogo de Chaves Combinadas" foi usado somente para teste.



Regras:



\- não tratá-lo como produto escolhido;

\- não publicar sua campanha;

\- não utilizar o teste como decisão comercial;

\- não assumir que a empresa decidiu atuar nesse nicho.



Existe uma campanha experimental local em:



```text

docs/campaigns/shopee/jogo-chaves-14-pecas/

```



Ela não foi publicada nem aprovada comercialmente. Pode ser removida somente após verificar o conteúdo e receber autorização ou confirmação clara de que o descarte faz parte da solicitação.



\---



\## 10. Marca e contas comerciais



Marca:



\*\*Radar de Escolhas\*\*



Contas comerciais criadas:



\- Pinterest Business;

\- TikTok;

\- Instagram;

\- Hotmart;

\- Shopee Afiliados.



Identificador usado nas redes quando disponível:



`@radardeescolhas`



Logo local:



```text

docs/brand/radar-de-escolhas-profile.png

```



Regras da marca:



\- manter independência da identidade pessoal da usuária;

\- não usar logotipos das plataformas como se fossem da marca;

\- não sugerir parceria oficial inexistente;

\- informar quando o conteúdo contém link de afiliado;

\- evitar promessas enganosas;

\- conferir disponibilidade, preço e condições antes de publicar;

\- não inventar características de produtos;

\- não produzir avaliações falsas.



\---



\## 11. Segurança e conformidade



Toda automação deve respeitar:



\- isolamento por usuário;

\- auditoria pelo Guardian;

\- princípio do menor privilégio;

\- separação entre simulação e execução real;

\- confirmação para ações financeiras;

\- confirmação para publicação pública durante a fase inicial;

\- identificação da origem dos dados;

\- proteção de credenciais;

\- interrupção segura;

\- idempotência;

\- limites de repetição;

\- controle de frequência;

\- tratamento de falhas;

\- ausência de spam;

\- termos das plataformas;

\- legislação e regras de publicidade aplicáveis.



Nunca:



\- comprar seguidores;

\- gerar engajamento falso;

\- publicar avaliações falsas;

\- fazer spam;

\- contornar restrições das plataformas;

\- usar APIs privadas sem autorização;

\- esconder publicidade de afiliado;

\- executar gastos sem política e autorização;

\- armazenar dados pessoais desnecessários;

\- afirmar que uma ação ocorreu quando foi apenas simulada.



\---



\## 12. Testes e validação



Na última validação confirmada:



```text

API: 19/19 testes aprovados

Build web: aprovado

```



Também foram anteriormente confirmados:



\- build do monorepo;

\- smoke da API;

\- smoke da interface;

\- persistência após reinício;

\- isolamento multiusuário;

\- autenticação Hotmart;

\- links Shopee oficiais;

\- proteção das credenciais.



Execute novamente os testes antes de confiar nesses resultados.



\---



\## 13. Limitações prioritárias



O Atlas ainda não consegue sozinho:



1\. pesquisar automaticamente a internet;

2\. coletar tendências verificáveis;

3\. descobrir produtos reais continuamente;

4\. comparar ofertas de múltiplas plataformas;

5\. criar conteúdo usando IA real;

6\. produzir imagens e vídeos dentro do próprio fluxo;

7\. publicar no Pinterest, Instagram e TikTok;

8\. capturar automaticamente métricas completas;

9\. atribuir vendas ao conteúdo e à campanha;

10\. aprender continuamente com resultados reais;

11\. selecionar novos testes de forma autônoma;

12\. interromper e otimizar campanhas automaticamente;

13\. operar continuamente por agenda ou fila;

14\. recuperar-se sozinho de falhas;

15\. escalar investimentos reais.



\---



\## 14. Prioridade técnica imediata



A próxima fase correta não é escolher outro produto.



A prioridade é ativar e validar a inteligência real.



\### Etapa A — Provider Claude real



O código atual possui um protocolo compatível com OpenAI em:



```text

packages/core/src/index.ts

apps/api/src/atlas.ts

```



O README informa que Claude nativo ainda exige gateway compatível.



Antes de configurar, decidir entre:



1\. implementar um provider nativo da API Anthropic; ou

2\. utilizar um gateway explicitamente autorizado e compatível.



Preferência arquitetural:



> Implementar `AnthropicAiProvider` nativo, mantendo a interface `AiProvider`, sem quebrar o provider mock utilizado nos testes.



Configuração esperada:



```text

AI\_PROVIDER=claude

AI\_MODEL=<modelo Claude autorizado>

AI\_API\_KEY=<variável local, nunca versionada>

```



A chave deve ser configurada localmente. Nunca solicitar que a usuária cole a chave no chat.



\### Etapa B — Teste real controlado



Após conectar Claude:



1\. verificar o status do provider;

2\. executar uma missão comercial pequena;

3\. registrar provider, modelo e modo;

4\. confirmar que a resposta veio da API real;

5\. validar formato estruturado;

6\. testar timeout;

7\. testar erro de autenticação;

8\. testar indisponibilidade;

9\. testar fallback seguro;

10\. confirmar que nenhum segredo aparece nos logs.



\### Etapa C — Conteúdo com IA real



O `ContentStudio` precisa parar de depender apenas de `local-content-rules`.



A nova arquitetura deve:



\- receber oportunidade e produto reais;

\- incluir fonte e evidências;

\- chamar o provider;

\- exigir resposta estruturada;

\- impedir alegações sem evidência;

\- identificar o modelo utilizado;

\- manter a peça em revisão;

\- registrar auditoria;

\- continuar funcionando em modo determinístico para testes.



\### Etapa D — Pesquisa externa



Criar ferramentas autorizadas para:



\- pesquisa web;

\- tendências;

\- dados da Hotmart;

\- produtos e sinais da Shopee;

\- SEO;

\- concorrência;

\- validação de fontes.



Todo dado deve registrar:



\- URL ou origem;

\- data da coleta;

\- tipo do dado;

\- confiança;

\- se é confirmado, estimado, calculado ou simulado.



\### Etapa E — Ciclo operacional



Depois da IA e das fontes reais:



```text

coletar

→ analisar

→ ranquear

→ selecionar teste

→ criar conteúdo

→ solicitar aprovação

→ publicar

→ medir

→ aprender

→ otimizar

```



Implementar primeiro com supervisão humana. Aumentar autonomia apenas após resultados verificáveis.



\---



\## 15. Critérios para considerar a IA ativa



Não declarar que a IA está funcionando apenas porque o Atlas inicia.



A IA só poderá ser considerada ativa quando:



\- o status mostrar provider real;

\- o modo for `live`;

\- uma chamada real for confirmada;

\- o modelo responder com estrutura válida;

\- provider e modelo aparecerem na auditoria;

\- erros e timeouts forem tratados;

\- não houver exposição de chave;

\- a resposta influenciar uma missão real;

\- conteúdo gerado pelo LLM ficar claramente identificado;

\- testes determinísticos continuarem funcionando sem depender da API.



\---



\## 16. Critérios para considerar a empresa autônoma



Não declarar autonomia completa enquanto faltar qualquer item essencial:



\- coleta automática;

\- IA real;

\- produtos reais;

\- conteúdo real;

\- conectores de publicação;

\- métricas reais;

\- aprendizagem real;

\- agenda ou fila contínua;

\- recuperação de falhas;

\- controles financeiros;

\- auditoria;

\- interrupção segura.



O Atlas pode evoluir em níveis:



```text

Nível 0 — simulação

Nível 1 — IA real assistida

Nível 2 — execução com aprovação

Nível 3 — automação limitada por políticas

Nível 4 — operação autônoma supervisionada

```



Estado atual aproximado:



\*\*Nível 0, com algumas integrações reais e infraestrutura pronta para o Nível 1.\*\*



\---



\## 17. Como trabalhar neste projeto



Antes de implementar:



1\. revisar o repositório;

2\. executar os testes;

3\. verificar mudanças locais;

4\. preservar arquivos da usuária;

5\. confirmar o provider efetivamente ativo;

6\. apresentar diagnóstico baseado em evidências.



Ao implementar:



\- criar branch nova baseada em `develop`;

\- limitar o escopo;

\- adicionar testes;

\- não modificar dados locais;

\- não incluir segredos;

\- manter compatibilidade com mock;

\- diferenciar execução real e simulada;

\- atualizar documentação;

\- executar testes e builds;

\- abrir PR em rascunho;

\- não realizar merge sem validação.



\---



\## 18. Primeira tarefa recomendada ao Claude



Faça uma auditoria técnica do provider atual e implemente a conexão real com Claude de forma segura.



Entregáveis:



1\. `AnthropicAiProvider` nativo;

2\. configuração por variáveis de ambiente;

3\. validação de credenciais sem exposição;

4\. resposta estruturada;

5\. timeout e cancelamento;

6\. tratamento de rate limit;

7\. retry limitado e seguro;

8\. auditoria com provider e modelo;

9\. fallback controlado;

10\. testes unitários sem chamadas externas;

11\. teste real opcional, executado somente com credencial local;

12\. indicador claro na interface:

&#x20;  - IA real ativa;

&#x20;  - modo simulado;

&#x20;  - provider indisponível.



Depois, execute uma única missão comercial controlada e apresente evidências de que a resposta veio do Claude real.



Não iniciar campanhas ou escolher produtos antes dessa validação.

