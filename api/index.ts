// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled by the Express app.
// The app is loaded lazily so that a startup failure (missing DATABASE_URL, bad import) comes back as a JSON
// error the UI can display, instead of Vercel's generic 500 page.
import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let appPromise: Promise<Handler> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    appPromise ??= import("../server/app").then((m) => m.app as unknown as Handler);
    const app = await appPromise;
    app(req, res);
  } catch (e) {
    appPromise = null;
    const message = e instanceof Error ? e.message : String(e);
    console.error("API failed to start:", e);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: `API failed to start: ${message}` }));
  }
}
