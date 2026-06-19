import type { SESEvent } from "aws-lambda";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { randomUUID } from "node:crypto";
import type { Address, Attachment, Email } from "postal-mime";
import { requiredEnv, optionalEnv, parseJsonEnv } from "../config";
import { attachmentContentBuffer, parseEmail } from "../email";
import { getObjectBuffer } from "../s3";
import { ses } from "../aws";

type ForwardingAliases = Record<string, string[]>;

export async function handler(event: SESEvent): Promise<void> {
  const bucket = requiredEnv("RAW_EMAIL_BUCKET");
  const prefix = optionalEnv("RAW_FORWARD_PREFIX", "forward/");
  const forwarderFrom = requiredEnv("FORWARDER_FROM");
  const aliases = normalizeAliases(parseJsonEnv<ForwardingAliases>("FORWARDING_ALIASES", {}));

  for (const record of event.Records) {
    const messageId = record.ses.mail.messageId;
    const recipients = record.ses.mail.destination.map((recipient) => recipient.toLowerCase());
    const targets = Array.from(new Set(recipients.flatMap((recipient) => aliases[recipient] || [])));

    if (targets.length === 0) {
      console.warn("No forwarding targets found", { messageId, recipients });
      continue;
    }

    const raw = await getObjectBuffer(bucket, `${prefix}${messageId}`);
    const parsed = await parseEmail(raw);

    const forwardedRaw = buildForwardedRawEmail({
      from: forwarderFrom,
      to: targets.join(", "),
      replyTo: formatAddress(parsed.from),
      subject: parsed.subject ? `Fwd: ${parsed.subject}` : "Fwd: message from meekmail",
      text: parsed.text || "",
      html: parsed.html,
      attachments: parsed.attachments,
      originalMessageId: messageId
    });
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: forwarderFrom,
        Destination: {
          ToAddresses: targets
        },
        Content: {
          Raw: {
            Data: forwardedRaw
          }
        }
      })
    );
  }
}

function normalizeAliases(aliases: ForwardingAliases): ForwardingAliases {
  return Object.fromEntries(
    Object.entries(aliases).map(([address, targets]) => [
      address.toLowerCase(),
      targets.map((target) => target.toLowerCase())
    ])
  );
}

function buildForwardedRawEmail(params: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments: Email["attachments"];
  originalMessageId: string;
}): Buffer {
  const mixedBoundary = `mixed-${randomUUID()}`;
  const alternativeBoundary = `alt-${randomUUID()}`;
  const lines: string[] = [
    `From: ${sanitizeHeader(params.from)}`,
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${encodeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    `X-Meekmail-Original-Message-Id: ${sanitizeHeader(params.originalMessageId)}`
  ];

  if (params.replyTo) {
    lines.push(`Reply-To: ${sanitizeHeader(params.replyTo)}`);
  }

  lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, "");
  lines.push(`--${mixedBoundary}`);

  if (params.html) {
    lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, "");
    lines.push(`--${alternativeBoundary}`);
    lines.push(textPart("text/plain", params.text || htmlToPlainText(params.html)));
    lines.push(`--${alternativeBoundary}`);
    lines.push(textPart("text/html", params.html));
    lines.push(`--${alternativeBoundary}--`);
  } else {
    lines.push(textPart("text/plain", params.text || ""));
  }

  for (const attachment of params.attachments) {
    lines.push(`--${mixedBoundary}`);
    lines.push(attachmentPart(attachment));
  }

  lines.push(`--${mixedBoundary}--`, "");
  return Buffer.from(lines.join("\r\n"));
}

function textPart(contentType: string, value: string): string {
  return [
    `Content-Type: ${contentType}; charset=utf-8`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(value, "utf8").toString("base64"))
  ].join("\r\n");
}

function attachmentPart(attachment: Attachment): string {
  const filename = sanitizeHeader(attachment.filename || "attachment");
  const contentType = sanitizeHeader(attachment.mimeType || "application/octet-stream");
  const content = attachmentContentBuffer(attachment);

  return [
    `Content-Type: ${contentType}; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    wrapBase64(content.toString("base64"))
  ].join("\r\n");
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

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string): string {
  const sanitized = sanitizeHeader(value);
  if (/^[\x20-\x7e]*$/.test(sanitized)) {
    return sanitized;
  }

  return `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
