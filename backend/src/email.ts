import PostalMime, { type Attachment, type Email } from "postal-mime";
import sanitizeHtml from "sanitize-html";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { StoredImage } from "./types";

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function parseEmail(raw: Buffer): Promise<Email> {
  return PostalMime.parse(raw, {
    attachmentEncoding: "arraybuffer",
    maxNestingDepth: 20
  });
}

export function subjectMatchesPassword(subject: string | undefined, password: string): boolean {
  return (subject || "").trim() === password;
}

export function deriveTitle(text: string | undefined): string {
  const firstLine = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Untitled";
  }

  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

export function sanitizePostHtml(html: string, assetsBaseUrl: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "blockquote",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "pre",
      "code",
      "img",
      "h1",
      "h2",
      "h3"
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer"
        }
      })
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") {
        return false;
      }

      const src = frame.attribs.src || "";
      return !src.startsWith(assetsBaseUrl);
    }
  });
}

export function rewriteCidImages(html: string, imagesByCid: Map<string, StoredImage>): string {
  return html.replace(/src=(["'])cid:([^"']+)\1/gi, (match, quote: string, cid: string) => {
    const image = imagesByCid.get(normalizeCid(cid));
    return image ? `src=${quote}${image.url}${quote}` : match;
  });
}

export function normalizeCid(cid: string | undefined): string {
  return (cid || "").replace(/^<|>$/g, "").trim().toLowerCase();
}

export interface AcceptedImage {
  id: string;
  attachment: Attachment;
  contentType: string;
  extension: string;
}

export function selectImages(attachments: Attachment[]): AcceptedImage[] {
  const accepted: AcceptedImage[] = [];
  let totalBytes = 0;

  for (const attachment of attachments) {
    if (accepted.length >= MAX_IMAGES) {
      break;
    }

    const content = attachmentContentBuffer(attachment);
    const detected = detectImageType(content);
    if (!detected || !allowedImageTypes.has(detected.contentType)) {
      continue;
    }

    const nextTotal = totalBytes + content.length;
    if (nextTotal > MAX_IMAGE_BYTES) {
      continue;
    }

    totalBytes = nextTotal;
    accepted.push({
      id: randomUUID(),
      attachment,
      contentType: detected.contentType,
      extension: detected.extension
    });
  }

  return accepted;
}

export function detectImageType(content: Buffer): { contentType: string; extension: string } | undefined {
  if (content.length >= 4 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  const signature = content.subarray(0, 6).toString("ascii");
  if (signature === "GIF87a" || signature === "GIF89a") {
    return { contentType: "image/gif", extension: "gif" };
  }

  if (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return undefined;
}

export function imageObjectKey(messageId: string, image: AcceptedImage): string {
  const safeFilename = image.attachment.filename ? sanitizeFilename(image.attachment.filename) : "";
  const suffix = safeFilename ? `-${safeFilename}` : `.${image.extension}`;
  const suffixWithExtension = extname(suffix) ? suffix : `${suffix}.${image.extension}`;
  return `posts/${messageId}/${image.id}${suffixWithExtension}`;
}

export function attachmentContentBuffer(attachment: Attachment): Buffer {
  if (typeof attachment.content === "string") {
    return Buffer.from(attachment.content, attachment.encoding === "base64" ? "base64" : "utf8");
  }

  if (attachment.content instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(attachment.content));
  }

  return Buffer.from(attachment.content);
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 96);
}
