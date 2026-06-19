export type MessageStatus = "PUBLISHED" | "REMOVED" | "REJECTED";

export interface StoredImage {
  id: string;
  url: string;
  key: string;
  contentType: string;
  size: number;
  filename?: string;
  cid?: string;
}

export interface StoredPost {
  message_id: string;
  status: MessageStatus;
  title: string;
  body_text: string;
  body_html?: string;
  images: StoredImage[];
  from_text?: string;
  from_address?: string;
  raw_s3_bucket: string;
  raw_s3_key: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface PublicPost {
  id: string;
  title: string;
  bodyText: string;
  bodyHtml?: string;
  images: StoredImage[];
  from?: string;
  publishedAt: string;
}
