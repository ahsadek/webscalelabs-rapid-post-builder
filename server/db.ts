import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";

// Locally, read app/.env and then the repo-root .env. On Vercel the variable comes from the
// project settings, so skip file loading there.
if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
}

let instance: pg.Pool | null = null;

/** The pool is created on first use, so importing this module never throws; a missing URL fails the request instead. */
export function getPool(): pg.Pool {
  if (!instance) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Locally: put it in app/.env. On Vercel: add it in the project's environment variables and redeploy.",
      );
    }
    instance = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 5 });
  }
  return instance;
}

export const pool = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) => getPool().query<T>(text, params),
  connect: () => getPool().connect(),
  end: () => (instance ? instance.end() : Promise.resolve()),
};

export const query = pool.query;
