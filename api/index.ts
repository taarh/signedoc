/**
 * Vercel serverless entry. Export the Express app so Vercel runs it directly.
 * MongoDB is connected on first request via middleware.
 * Uses ./server.js produced by npm run build:server (see vercel buildCommand).
 */
import { app, connectDb } from "./server.js";

let dbReady: Promise<void> | null = null;
function ensureDb() {
  if (!dbReady) dbReady = connectDb();
  return dbReady;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error("[api] MongoDB error:", err instanceof Error ? err.message : err);
    next(err);
  }
});

app.use((err: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  res.status(503).json({ error: "Service unavailable", message: err instanceof Error ? err.message : "Database connection failed" });
});

export default app;
