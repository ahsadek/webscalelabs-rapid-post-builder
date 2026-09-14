/**
 * Local entry point: runs the API on a port and, after `npm run build`, also serves the built UI from dist/.
 * On Vercel this file is not used; api/index.ts exposes the same Express app as a serverless function.
 */
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app } from "./app";
import { pool } from "./db";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3210;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

process.on("SIGTERM", () => pool.end().then(() => process.exit(0)));
