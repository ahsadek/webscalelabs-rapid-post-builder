// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled by the Express app.
// Relative imports carry a .js extension because Vercel runs this as an ES module; the TypeScript sources are
// compiled next to it at deploy time. Startup problems (for example a missing DATABASE_URL) are raised lazily
// inside request handling, so they come back as JSON errors the UI can display.
import { app } from "../server/app.js";
export default app;
