import type { SESEvent } from "aws-lambda";
import type { Address } from "postal-mime";
import { requiredEnv, optionalEnv } from "../config";
import { getObjectBuffer, putObjectBuffer } from "../s3";
import {
  deriveTitle,
  attachmentContentBuffer,
  imageObjectKey,
  normalizeCid,
  parseEmail,
  rewriteCidImages,
  sanitizePostHtml,
  selectImages,
  subjectMatchesPassword
} from "../email";
import { getSecretString } from "../secrets";
import { putPost } from "../ddb";
import type { StoredImage, StoredPost } from "../types";

export async function handler(event: SESEvent): Promise<void> {
  const rawBucket = requiredEnv("RAW_EMAIL_BUCKET");
  const rawPrefix = optionalEnv("RAW_YARLY_PREFIX", "yarly/");
  const assetsBucket = requiredEnv("ASSETS_BUCKET");
  const assetsBaseUrl = requiredEnv("ASSETS_BASE_URL").replace(/\/$/, "");
  const tableName = requiredEnv("MESSAGES_TABLE");
  const secretId = requiredEnv("YARLY_SECRET_ID");
  const password = await getSecretString(secretId);

  for (const record of event.Records) {
    const messageId = record.ses.mail.messageId;
    const rawKey = `${rawPrefix}${messageId}`;
    const raw = await getObjectBuffer(rawBucket, rawKey);
    const parsed = await parseEmail(raw);

    if (!subjectMatchesPassword(parsed.subject, password)) {
      console.warn("Skipping yarly message with invalid subject", { messageId });
      continue;
    }

    const acceptedImages = selectImages(parsed.attachments);
    const storedImages: StoredImage[] = [];
    const imagesByCid = new Map<string, StoredImage>();

    for (const image of acceptedImages) {
      const key = imageObjectKey(messageId, image);
      const content = attachmentContentBuffer(image.attachment);
      await putObjectBuffer({
        bucket: assetsBucket,
        key,
        body: content,
        contentType: image.contentType,
        cacheControl: "public, max-age=31536000, immutable"
      });

      const stored: StoredImage = {
        id: image.id,
        url: `${assetsBaseUrl}/${key}`,
        key,
        contentType: image.contentType,
        size: content.length,
        filename: image.attachment.filename || undefined,
        cid: normalizeCid(image.attachment.contentId)
      };
      storedImages.push(stored);

      if (stored.cid) {
        imagesByCid.set(stored.cid, stored);
      }
    }

    const bodyText = parsed.text?.trim() || "";
    const rewrittenHtml = parsed.html ? rewriteCidImages(String(parsed.html), imagesByCid) : undefined;
    const bodyHtml = rewrittenHtml ? sanitizePostHtml(rewrittenHtml, assetsBaseUrl) : undefined;
    const now = new Date().toISOString();

    const post: StoredPost = {
      message_id: messageId,
      status: "PUBLISHED",
      title: deriveTitle(bodyText),
      body_text: bodyText,
      body_html: bodyHtml,
      images: storedImages,
      from_text: formatAddress(parsed.from),
      from_address: "address" in (parsed.from || {}) ? parsed.from?.address : undefined,
      raw_s3_bucket: rawBucket,
      raw_s3_key: rawKey,
      published_at: now,
      created_at: now,
      updated_at: now
    };

    await putPost(tableName, post);
  }
}

function formatAddress(address: Address | undefined): string | undefined {
  if (!address) {
    return undefined;
  }

  if (Array.isArray(address.group)) {
    return address.group.map(formatAddress).filter(Boolean).join(", ");
  }

  return address.name ? `${address.name} <${address.address}>` : address.address;
}
