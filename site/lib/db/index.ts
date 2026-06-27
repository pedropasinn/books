import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Conexão HTTP serverless (Neon). Diferente do libSQL file-based, não toca o
// filesystem — funciona no runtime read-only do Vercel. As env vars são
// injetadas pela integração Neon; em dev local ficam no .env.local.
const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada (integração Neon ou .env.local)");
}

export const db = drizzle(neon(connectionString), { schema });
export * from "./schema";
