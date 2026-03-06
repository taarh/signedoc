/**
 * Bundle server.ts into api/server.js for Vercel so the serverless function can import it.
 * Run: node scripts/build-server.mjs
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "server.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: path.join(root, "api", "server.js"),
  external: ["mongodb", "vite"],
  define: {
    "process.env.VERCEL": '"1"',
  },
}).catch(() => process.exit(1));

console.log("api/server.js created");
