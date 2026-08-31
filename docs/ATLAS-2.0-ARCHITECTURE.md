# Atlas 2.0 — arquitetura de produto

Atlas é o sistema operacional interno. Radar de Escolhas é a primeira marca/empresa operada nele. O produto deve ser multiempresa: nenhum conector, regra ou dado pode depender do nome Radar.

## Fluxo operacional

1. Descobrir ofertas em Hotmart, Shopee, Mercado Livre e TikTok Shop.
2. Validar afiliação, disponibilidade, preço, destino e direitos do material.
3. Pontuar oportunidade com evidência rastreável.
4. Preparar conteúdo por canal sem inventar benefícios, preço ou desconto.
5. Aplicar política de frequência, duplicidade, horário e risco.
6. Publicar por conectores oficiais em Instagram, TikTok, YouTube, Pinterest, Telegram e WhatsApp.
7. Registrar identificador externo, entrega, clique, conversão, receita e comissão.
8. Atualizar os próximos ciclos com dados confirmados.

## Serviços de produção

- `api`: autenticação, painel e webhooks.
- `worker`: processo permanente que consome a fila, renova leases e executa conectores.
- `scheduler`: cria trabalhos periódicos; não publica diretamente.
- PostgreSQL: fonte de verdade transacional e isolamento por organização.
- Redis/queue: coordenação de trabalho e baixa latência; o banco continua sendo o registro definitivo.
- Object storage: mídia autorizada e comprovantes de licença.

## Canais e fornecedores

| Papel | Plataformas |
| --- | --- |
| Fornecedores de oferta | Hotmart, Shopee, Mercado Livre, TikTok Shop |
| Publicação social | Instagram, TikTok, YouTube, Pinterest |
| Mensageria | Telegram, WhatsApp |
| Destino próprio | páginas de oferta do Radar de Escolhas |

Cada integração deve declarar `capabilities` (descobrir, criar link, publicar, consultar métricas), estado de autenticação e modo `live`. Ausência de capacidade nunca pode cair silenciosamente em simulação.

## Regras inegociáveis

- Execução idempotente: a mesma oferta/agendamento não pode ser publicado duas vezes.
- Revalidar preço, disponibilidade e URL imediatamente antes da publicação.
- Mídia exige origem, permissão de uso, checksum e eventual validade.
- Somente API oficial; automação de navegador não é infraestrutura de produção.
- Opt-in e opt-out em mensageria; limites e horários por organização.
- Kill switch global, por organização e por canal.
- Segredos nunca ficam no repositório nem são devolvidos pela API.
- Falha repetida vai para dead letter e gera alerta, sem loop infinito.
- Todo resultado informa se é confirmado, estimado ou indisponível.

## Critérios para chamar de 2.0

- 72 horas contínuas sem intervenção e sem duplicidade.
- Reinício do worker sem perda de trabalho.
- Publicações reais retornam IDs externos verificáveis.
- Links quebrados, preço vencido e mídia sem licença bloqueiam a saída.
- Cliques e conversões são atribuídos até a oferta e ao canal.
- Uma segunda empresa pode ser criada sem alterar código.
