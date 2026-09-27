import "server-only";
import sharp from "sharp";
import { COVER_TYPES, MAX_COVER_BYTES } from "./cover-settings";

export async function validateCover(file: File) {
  if (!file.size || file.size > MAX_COVER_BYTES) throw new Error("Choose an image between 1 byte and 3 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const formats: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
  if (!extension || !formats[extension] || (file.type && !COVER_TYPES.includes(file.type))) {
    throw new Error("Choose a JPG, PNG or WebP image. PDFs and other file types are not supported here.");
  }
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "warning", limitInputPixels: 24000000 });
    const metadata = await image.metadata();
    if (metadata.format !== formats[extension] || (file.type && file.type !== "image/" + metadata.format) || (metadata.pages ?? 1) > 1) throw new Error();
    // Decode all pixels; strip metadata and trailing payloads, without cropping/resizing.
    const bytes = await image.rotate().toFormat(metadata.format, { quality: 95 }).toBuffer();
    if (bytes.length > MAX_COVER_BYTES) throw new Error();
    return { bytes, extension: metadata.format === "jpeg" ? "jpg" : metadata.format, contentType: "image/" + metadata.format };
  } catch {
    throw new Error("This image could not be processed. Use a valid, still JPG, PNG or WebP, at most 24 megapixels and 3 MB after processing.");
  }
}
