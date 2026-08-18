# Atlas OS — implantação de produção

## Pré-requisitos

- Dois endereços HTTPS: um para a Web e outro para a API.
- Docker com Compose.
- Volume persistente e backup para `/data`.
- Segredos configurados no provedor; nunca adicionados à imagem ou ao Git.

## Validação antes da implantação

Crie um arquivo privado de ambiente a partir de `.env.production.example`. Em Node 20 ou superior, valide:

```sh
node --env-file=.env.production scripts/check-production-readiness.mjs
```

Use `--require-social` quando pelo menos um canal social já tiver OAuth oficial aprovado.

## Subir os serviços

Execute a partir da raiz do repositório, informando o arquivo privado que contém `ATLAS_PUBLIC_URL` e `CORS_ORIGIN`:

```sh
docker compose --env-file .env.production -f infrastructure/compose.production.yml up --build -d
```

Confirme `GET https://SEU-DOMINIO-API/health` antes de liberar a Web.

## Persistência e backup

O volume `atlas-data` contém `atlas.db`, o segredo local de contingência e a pasta `media`. Faça backup consistente do volume com os serviços parados ou usando um snapshot do provedor. Restaurar apenas o banco sem a pasta de mídia deixa campanhas sem seus criativos.

## Ativação social

Instagram exige conta profissional, aplicativo Meta autorizado, `INSTAGRAM_ACCOUNT_ID`, token OAuth e mídia acessível pelo domínio HTTPS da API. TikTok exige aplicativo aprovado, escopo de publicação, autorização OAuth do criador e domínio de mídia verificado. Ative um canal por vez e primeiro use a privacidade `SELF_ONLY` no TikTok.

Não habilite `ATLAS_AUTO_PUBLISH` ou `ATLAS_AUTO_SCALE`: o fluxo atual preserva aprovação humana antes da publicação e não executa mudanças financeiras externas.
