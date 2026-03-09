// Load .env only locally; Vercel injects env vars and dotenv uses dynamic require("fs") which fails in serverless
if (!process.env.VERCEL) {
  const dotenv = await import("dotenv");
  dotenv.config();
}
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { put as blobPut } from "@vercel/blob";
import { generateSignedPdf } from "./lib/generateSignedPdf";
import { sendSigningLink, sendSignedPdfLink } from "./lib/sendMail";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = Boolean(process.env.VERCEL);

// If MONGO_PASSWORD is set, inject it (URL-encoded) into MONGO_URI to support special characters
function getMongoUri(): string {
  const base = process.env.MONGO_URI || "mongodb://localhost:27017/signflow";
  const password = process.env.MONGO_PASSWORD;
  if (!password) return base;
  return base.replace(/(:\/\/[^:]+:)([^@]+)(@)/, (_, prefix, _old, suffix) => prefix + encodeURIComponent(password) + suffix);
}
const MONGO_URI = getMongoUri();
const PORT = Number(process.env.PORT) || 3000;

let db: import("mongodb").Db;

let dbReady: Promise<void> | null = null;
function ensureDb() {
  if (!dbReady) dbReady = connectDb();
  return dbReady;
}

async function connectDb() {
  const client = new MongoClient(MONGO_URI);
  const maxAttempts = process.env.VERCEL ? 3 : 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.connect();
      break;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      console.log(`MongoDB connection attempt ${attempt}/${maxAttempts}, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  db = client.db();
  await db.collection("documents").createIndex({ id: 1 }, { unique: true });
  await db.collection("documents").createIndex({ created_at: -1 });
  await db.collection("signers").createIndex({ document_id: 1 });
  await db.collection("signers").createIndex({ access_token: 1 }, { unique: true });
  await db.collection("fields").createIndex({ document_id: 1 });
  await db.collection("audit_trail").createIndex({ timestamp: -1 });
  await db.collection("audit_trail").createIndex({ document_id: 1 });
  console.log("MongoDB connected");
}

type AuditEvent = "uploaded" | "sent" | "signed" | "completed";

async function addAudit(documentId: string, event: AuditEvent, details?: string, userName?: string, docName?: string) {
  await db.collection("audit_trail").insertOne({
    id: uuidv4(),
    document_id: documentId,
    event,
    timestamp: new Date(),
    details: details ?? null,
    user_name: userName ?? null,
    doc_name: docName ?? null,
  });
}

const UPLOAD_DIR = isVercel ? path.join(os.tmpdir(), "signedoc-uploads") : path.join(process.cwd(), "uploads");

const app = express();
const httpServer = createServer(app);
const io = isVercel ? null : new Server(httpServer, { cors: { origin: "*" } });

app.use(express.json());
// Ensure MongoDB is connected before any route that uses db (must run first)
app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (e) {
    next(e);
  }
});
app.use("/uploads", express.static(UPLOAD_DIR));

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (_) {
  // On Vercel /tmp may have restrictions; ignore so the app still loads
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

// ----- API Routes -----

app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const id = uuidv4();
    const name = req.file.originalname;
    const file_path = req.file.path;
    const docPayload: { id: string; name: string; file_path: string; status: string; created_at: Date; blob_url?: string } = {
      id,
      name,
      file_path,
      status: "draft",
      created_at: new Date(),
    };
    // If a Blob token is configured (on Vercel), upload the PDF to Blob storage
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        console.log("[Blob] Uploading original PDF to Blob for document", id);
        const buf = fs.readFileSync(file_path);
        const blob = await blobPut(`documents/${id}/${name}`, buf, { access: "public", contentType: "application/pdf" });
        docPayload.blob_url = blob.url;
      } catch (e) {
        console.error("[Blob] Upload failed:", e);
      }
    }
    await db.collection("documents").insertOne(docPayload);
    await addAudit(id, "uploaded", `Document "${name}" uploaded`, undefined, name);
    res.json({ id, name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/documents", async (_req, res) => {
  try {
    const docs = await db
      .collection("documents")
      .find({})
      .sort({ created_at: -1 })
      .project({ _id: 0 })
      .toArray();
    res.json(docs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

app.get("/api/documents/:id", async (req, res) => {
  try {
    const doc = await db.collection("documents").findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const signers = await db.collection("signers").find({ document_id: req.params.id }).project({ _id: 0 }).toArray();
    const fields = await db.collection("fields").find({ document_id: req.params.id }).project({ _id: 0 }).toArray();
    res.json({ ...doc, signers, fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// Serve PDF file by document id (local file_path or redirect to Blob on Vercel)
app.get("/api/documents/:id/file", async (req, res) => {
  try {
    const doc = await db.collection("documents").findOne({ id: req.params.id }, { projection: { file_path: 1, blob_url: 1, name: 1 } });
    if (!doc) return res.status(404).json({ error: "Document file not found" });
    if (doc.blob_url) {
      return res.redirect(302, doc.blob_url);
    }
    if (!doc.file_path) return res.status(404).json({ error: "Document file not found" });
    const filePath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load file" });
  }
});

app.post("/api/documents/:id/signers", async (req, res) => {
  try {
    const { signers: signersBody } = req.body;
    const docId = req.params.id;
    const doc = await db.collection("documents").findOne({ id: docId });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const results: { id: string; token: string }[] = [];
    for (const s of signersBody) {
      const id = uuidv4();
      const token = uuidv4();
      await db.collection("signers").insertOne({
        id,
        document_id: docId,
        email: s.email,
        name: s.name,
        status: "pending",
        access_token: token,
      });
      results.push({ id, token });
    }
    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add signers" });
  }
});

app.post("/api/documents/:id/fields", async (req, res) => {
  try {
    const { fields } = req.body;
    const docId = req.params.id;
    await db.collection("fields").deleteMany({ document_id: docId });
    for (const f of fields) {
      await db.collection("fields").insertOne({
        id: uuidv4(),
        document_id: docId,
        signer_id: f.signer_id,
        type: f.type,
        x: f.x,
        y: f.y,
        page: f.page,
        width: f.width,
        height: f.height,
        value: null,
      });
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save fields" });
  }
});

app.post("/api/documents/:id/send", async (req, res) => {
  try {
    const docId = req.params.id;
    const doc = await db.collection("documents").findOne({ id: docId });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    await db.collection("documents").updateOne({ id: docId }, { $set: { status: "sent" } });
    const signers = await db.collection("signers").find({ document_id: docId }).project({ _id: 0 }).toArray();
    await addAudit(docId, "sent", `Workflow sent to ${signers.length} signer(s)`, undefined, doc.name);

    // Envoyer l'email à chaque signataire avec le lien de signature
    const baseUrl = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "") || `http://localhost:${PORT}`;
    for (const signer of signers) {
      await sendSigningLink({
        signerName: signer.name,
        signerEmail: signer.email,
        documentName: doc.name,
        signToken: signer.access_token,
      });
    }

    res.json({ success: true, signers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to send" });
  }
});

app.get("/api/activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const events = await db
      .collection("audit_trail")
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .project({ _id: 0 })
      .toArray();
    res.json(events);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

app.get("/api/documents/:id/signed-pdf", async (req, res) => {
  try {
    const doc = await db.collection("documents").findOne({ id: req.params.id }, { projection: { signed_file_path: 1, signed_blob_url: 1, name: 1 } });
    if (!doc) return res.status(404).json({ error: "Signed PDF not ready" });
    if (doc.signed_blob_url) {
      return res.redirect(302, doc.signed_blob_url);
    }
    if (!doc.signed_file_path) return res.status(404).json({ error: "Signed PDF not ready" });
    const filePath = path.isAbsolute(doc.signed_file_path) ? doc.signed_file_path : path.join(process.cwd(), doc.signed_file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Signed file not found" });
    res.download(filePath, doc.name ? doc.name.replace(/\.pdf$/i, "-signed.pdf") : "signed.pdf");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Download failed" });
  }
});

app.get("/api/sign/:token", async (req, res) => {
  try {
    const signer = await db.collection("signers").findOne({ access_token: req.params.token }, { projection: { _id: 0 } });
    if (!signer) return res.status(404).json({ error: "Invalid token" });
    const doc = await db.collection("documents").findOne({ id: signer.document_id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const fields = await db
      .collection("fields")
      .find({ document_id: signer.document_id, signer_id: signer.id })
      .project({ _id: 0 })
      .toArray();
    res.json({ signer, doc, fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load signing session" });
  }
});

app.post("/api/sign/:token", async (req, res) => {
  try {
    const { signatures } = req.body;
    const signer = await db.collection("signers").findOne({ access_token: req.params.token }, { projection: { _id: 0 } });
    if (!signer) return res.status(404).json({ error: "Invalid token" });
    const doc = await db.collection("documents").findOne({ id: signer.document_id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    for (const s of signatures) {
      await db.collection("fields").updateOne({ id: s.fieldId }, { $set: { value: s.value } });
    }
    await db.collection("signers").updateOne({ id: signer.id }, { $set: { status: "signed" } });
    await addAudit(signer.document_id, "signed", null, signer.name, doc.name);

    const remaining = await db.collection("signers").countDocuments({ document_id: signer.document_id, status: { $ne: "signed" } });
    if (remaining === 0) {
      await db.collection("documents").updateOne({ id: signer.document_id }, { $set: { status: "completed" } });
      await addAudit(signer.document_id, "completed", "All signers have signed", undefined, doc.name);

      // Generate signed PDF with pdf-lib (embed signatures, text, dates)
      try {
        const allFields = await db.collection("fields").find({ document_id: signer.document_id }).toArray();
        const fieldsWithValue = allFields.map((f: any) => ({
          id: f.id,
          type: f.type,
          x: f.x,
          y: f.y,
          page: f.page ?? 1,
          width: f.width,
          height: f.height,
          value: f.value ?? null,
        }));
        const tmpDir = os.tmpdir();
        let sourcePath: string;
        let signedPath: string;
        if (doc.blob_url && process.env.BLOB_READ_WRITE_TOKEN) {
          const resPdf = await fetch(doc.blob_url);
          if (!resPdf.ok) throw new Error("Failed to fetch source PDF from blob");
          const buf = Buffer.from(await resPdf.arrayBuffer());
          sourcePath = path.join(tmpDir, `source-${signer.document_id}.pdf`);
          signedPath = path.join(tmpDir, `signed-${signer.document_id}.pdf`);
          fs.writeFileSync(sourcePath, buf);
        } else {
          sourcePath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path);
          signedPath = path.join(path.dirname(sourcePath), `signed-${signer.document_id}.pdf`);
        }
        await generateSignedPdf(sourcePath, fieldsWithValue, signedPath);
        if (doc.blob_url && process.env.BLOB_READ_WRITE_TOKEN) {
          const signedBuf = fs.readFileSync(signedPath);
          const blob = await blobPut(`documents/${signer.document_id}/signed.pdf`, signedBuf, { access: "public", contentType: "application/pdf" });
          await db.collection("documents").updateOne(
            { id: signer.document_id },
            { $set: { signed_blob_url: blob.url } }
          );
        } else {
          await db.collection("documents").updateOne(
            { id: signer.document_id },
            { $set: { signed_file_path: signedPath } }
          );
        }
        const baseUrl = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "") || `http://localhost:${PORT}`;
        const downloadUrl = `${baseUrl}/api/documents/${signer.document_id}/signed-pdf`;
        const allSigners = await db.collection("signers").find({ document_id: signer.document_id }).toArray();
        for (const s of allSigners) {
          await sendSignedPdfLink({
            signerEmail: s.email,
            signerName: s.name,
            documentName: doc.name,
            downloadUrl,
          });
        }
      } catch (err) {
        console.error("Failed to generate signed PDF:", err);
      }
    }

    if (io) io.emit("document_updated", { documentId: signer.document_id });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to submit signature" });
  }
});

// Error handler for DB connection failures and other passed errors
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] Error:", err instanceof Error ? err.message : err);
  res.status(503).json({ error: "Service unavailable", message: err instanceof Error ? err.message : "Database connection failed" });
});

// ----- Static / Vite -----
const distPath = path.join(process.cwd(), "dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

async function start() {
  await connectDb();
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app, connectDb };

if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}
