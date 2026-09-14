import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Load app/.env first, then fall back to the repo-root .env one level up.
dotenv.config({ path: path.join(here, "..", ".env") });
dotenv.config({ path: path.join(here, "..", "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Put it in app/.env or the repo root .env.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 5,
});

export const query = <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) =>
  pool.query<T>(text, params);
