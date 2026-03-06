/**
 * Generate signed PDF using pdf-lib.
 * Embeds signature images, text and dates at field coordinates.
 */
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export interface FieldWithValue {
  id: string;
  type: string;
  x: number;
  y: number;
  page: number;
  width: number;
  height: number;
  value: string | null;
}

/** Scale from frontend pixels (e.g. viewer) to PDF points. A4 = 595×842 pt. */
const SCALE = 1;

export async function generateSignedPdf(
  sourcePath: string,
  fields: FieldWithValue[],
  outputPath: string
): Promise<void> {
  const bytes = await fs.readFile(sourcePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();

  const fieldsWithValue = fields.filter((f) => f.value != null && f.value !== "");
  for (const field of fieldsWithValue) {
    const pageIndex = Math.max(0, (field.page ?? 1) - 1);
    const page = pages[pageIndex];
    if (!page) continue;

    const pageHeight = page.getHeight();
    const x = field.x * SCALE;
    const w = field.width * SCALE;
    const h = field.height * SCALE;
    // PDF origin is bottom-left; frontend uses top-left
    const y = pageHeight - field.y * SCALE - h;

    if (field.type === "signature" || field.type === "initial") {
      const dataUrl = field.value!;
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imgBytes = Buffer.from(base64, "base64");
      try {
        const image = await pdfDoc.embedPng(imgBytes);
        page.drawImage(image, { x, y, width: w, height: h });
      } catch {
        try {
          const image = await pdfDoc.embedJpg(imgBytes);
          page.drawImage(image, { x, y, width: w, height: h });
        } catch (e) {
          console.error("Failed to embed signature image for field", field.id, e);
        }
      }
    } else if (field.type === "date" || field.type === "text") {
      const text = field.value ?? "";
      page.drawText(text, {
        x,
        y: y + h / 2 - 4,
        size: Math.min(10, h * 0.4),
        color: { type: "RGB", red: 0.06, green: 0.07, blue: 0.16 },
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdfBytes);
}
