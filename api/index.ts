/**
 * Vercel serverless entry: forward all /api and /uploads requests to Express.
 * MongoDB is connected on first request (lazy init).
 * Uses ./server.js produced by npm run build:server (see vercel buildCommand).
 */
import { app, connectDb } from "./server.js";

let dbReady: Promise<void> | null = null;

function ensureDb() {
  if (!dbReady) dbReady = connectDb();
  return dbReady;
}

export default async function handler(req: import("http").IncomingMessage, res: import("http").ServerResponse) {
  await ensureDb();
  app(req, res);
}
