import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("signflow.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signers (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    access_token TEXT NOT NULL,
    FOREIGN KEY(document_id) REFERENCES documents(id)
  );

  CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    signer_id TEXT NOT NULL,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    page INTEGER NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    value TEXT,
    FOREIGN KEY(document_id) REFERENCES documents(id),
    FOREIGN KEY(signer_id) REFERENCES signers(id)
  );

  CREATE TABLE IF NOT EXISTS audit_trail (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    event TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    FOREIGN KEY(document_id) REFERENCES documents(id)
  );
`);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// API Routes
app.post("/api/documents/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const id = uuidv4();
  const name = req.file.originalname;
  const file_path = req.file.path;

  db.prepare("INSERT INTO documents (id, name, file_path) VALUES (?, ?, ?)").run(id, name, file_path);

  res.json({ id, name });
});

app.get("/api/documents", (req, res) => {
  const docs = db.prepare("SELECT * FROM documents ORDER BY created_at DESC").all();
  res.json(docs);
});

app.get("/api/documents/:id", (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const signers = db.prepare("SELECT * FROM signers WHERE document_id = ?").all(req.params.id);
  const fields = db.prepare("SELECT * FROM fields WHERE document_id = ?").all(req.params.id);

  res.json({ ...doc, signers, fields });
});

app.post("/api/documents/:id/signers", (req, res) => {
  const { signers } = req.body;
  const docId = req.params.id;

  const insert = db.prepare("INSERT INTO signers (id, document_id, email, name, access_token) VALUES (?, ?, ?, ?, ?)");
  
  const results = signers.map((s: any) => {
    const id = uuidv4();
    const token = uuidv4();
    insert.run(id, docId, s.email, s.name, token);
    return { id, token };
  });

  res.json(results);
});

app.post("/api/documents/:id/fields", (req, res) => {
  const { fields } = req.body;
  const docId = req.params.id;

  db.prepare("DELETE FROM fields WHERE document_id = ?").run(docId);

  const insert = db.prepare("INSERT INTO fields (id, document_id, signer_id, type, x, y, page, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  
  fields.forEach((f: any) => {
    insert.run(uuidv4(), docId, f.signer_id, f.type, f.x, f.y, f.page, f.width, f.height);
  });

  res.json({ success: true });
});

app.post("/api/documents/:id/send", (req, res) => {
  db.prepare("UPDATE documents SET status = 'sent' WHERE id = ?").run(req.params.id);
  
  // In a real app, send emails here
  const signers = db.prepare("SELECT * FROM signers WHERE document_id = ?").all(req.params.id);
  
  res.json({ success: true, signers });
});

app.get("/api/sign/:token", (req, res) => {
  const signer = db.prepare("SELECT * FROM signers WHERE access_token = ?").get(req.params.token);
  if (!signer) return res.status(404).json({ error: "Invalid token" });

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(signer.document_id);
  const fields = db.prepare("SELECT * FROM fields WHERE document_id = ? AND signer_id = ?").all(signer.document_id, signer.id);

  res.json({ signer, doc, fields });
});

app.post("/api/sign/:token", (req, res) => {
  const { signatures } = req.body; // Array of { fieldId, value }
  const signer = db.prepare("SELECT * FROM signers WHERE access_token = ?").get(req.params.token);
  if (!signer) return res.status(404).json({ error: "Invalid token" });

  const updateField = db.prepare("UPDATE fields SET value = ? WHERE id = ?");
  signatures.forEach((s: any) => {
    updateField.run(s.value, s.fieldId);
  });

  db.prepare("UPDATE signers SET status = 'signed' WHERE id = ?").run(signer.id);

  // Check if all signers signed
  const remaining = db.prepare("SELECT COUNT(*) as count FROM signers WHERE document_id = ? AND status != 'signed'").get(signer.document_id);
  
  if (remaining.count === 0) {
    db.prepare("UPDATE documents SET status = 'completed' WHERE id = ?").run(signer.document_id);
  }

  io.emit("document_updated", { documentId: signer.document_id });

  res.json({ success: true });
});

// Vite Middleware
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const PORT = 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
