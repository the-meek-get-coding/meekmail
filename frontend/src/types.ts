export interface StoredImage {
  id: string;
  url: string;
  key: string;
  contentType: string;
  size: number;
  filename?: string;
  cid?: string;
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

export interface AdminPost {
  message_id: string;
  status: "PUBLISHED" | "REMOVED" | "REJECTED";
  title: string;
  body_text: string;
  body_html?: string;
  images: StoredImage[];
  from_text?: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}
