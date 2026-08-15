\# Instruções para o Claude Code neste projeto



\## Idioma



Responda sempre em português (pt-BR) nesta sessão e em todas as

interações futuras neste repositório — explicações, resumos de

commits, descrições de PR, comentários de revisão. Código,

identificadores técnicos, nomes de variáveis, mensagens de commit

técnicas e strings de log podem permanecer em inglês quando já for

o padrão do projeto.



\## Fonte de verdade



Antes de analisar, planejar ou alterar qualquer parte deste projeto,

leia integralmente `docs/handoff.md` — ele contém a missão oficial,

o estado real do Atlas, os limites do que pode e não pode ser feito,

e o fluxo de trabalho esperado.



Use como fonte de verdade, nesta ordem:



1\. `docs/handoff.md`;

2\. o repositório `atlas-os` em si;

3\. os arquivos `README.md`, `ROADMAP.md` e `SPRINT\_STATUS.md`;

4\. as decisões confirmadas pela usuária na conversa em andamento.



\## Regra de isolamento



O Atlas OS é um projeto completamente independente. Não misture a ele:



\- biblioteca inteligente;

\- gestão documental corporativa;

\- políticas, procedimentos ou documentos internos;

\- outros projetos da usuária;

\- requisitos obtidos de outras conversas;

\- arquiteturas ou roadmaps externos ao repositório.



Se encontrar divergência entre código, documentação e missão comercial,

informe claramente antes de alterar o produto.



\## Fluxo de trabalho



Antes de implementar: revisar o repositório, executar os testes,

verificar mudanças locais, preservar arquivos da usuária, confirmar o

provider efetivamente ativo, apresentar diagnóstico baseado em

evidências.



Ao implementar: criar branch nova baseada em `develop`; limitar o

escopo; adicionar testes; não modificar dados locais; não incluir

segredos; manter compatibilidade com mock; diferenciar execução real

e simulada; atualizar documentação; executar testes e builds; abrir

PR em rascunho; não realizar merge sem validação.



\## Nunca



\- Nunca revelar, logar, copiar para documentação ou enviar ao GitHub

&#x20; credenciais, tokens, senhas, e-mails particulares ou dados pessoais

&#x20; de compradores.

\- Nunca declarar que a IA real está ativa ou que a empresa é autônoma

&#x20; sem evidência técnica confirmada (ver critérios nas seções 15 e 16

&#x20; do handoff).

\- Nunca executar gastos ou publicações externas sem política e

&#x20; aprovação explícita.

