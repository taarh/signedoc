/**
 * Vercel serverless entry. Export the Express app (DB middleware is in server.ts).
 * Uses ./server.js produced by npm run build:server (see vercel buildCommand).
 */
import { app } from "./server.js";
export default app;
