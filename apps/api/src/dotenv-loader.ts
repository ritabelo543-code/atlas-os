// Este arquivo DEVE ser importado como a primeira linha
// para garantir que as variáveis de ambiente sejam carregadas antes de qualquer outro código
import * as dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../../");

// Carregar de .env.local primeiro (sobreescreve .env)
dotenv.config({ path: resolve(projectRoot, ".env.local") });
dotenv.config({ path: resolve(projectRoot, ".env") });
