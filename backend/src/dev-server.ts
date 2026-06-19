import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { deriveTitle } from "./email";
import type { PublicPost, StoredImage, StoredPost } from "./types";
import { toPublicPost } from "./ddb";

const port = Number(process.env.PORT || 3000);
const yarlyPassword = process.env.YARLY_DEV_PASSWORD || "meek";

const sampleImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23f0f4f8'/%3E%3Crect x='120' y='120' width='960' height='560' rx='16' fill='%23ffffff' stroke='%2394a3b8' stroke-width='8'/%3E%3Ccircle cx='370' cy='330' r='96' fill='%232563eb'/%3E%3Cpath d='M190 640 500 430 690 570 820 470 1010 640Z' fill='%2316a34a'/%3E%3Ctext x='600' y='720' text-anchor='middle' font-family='Arial' font-size='54' fill='%23334155'%3EMeekmail image test%3C/text%3E%3C/svg%3E";

const posts = new Map<string, StoredPost>();

seedPost();

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  try {
    if (request.method === "GET" && url.pathname === "/posts") {
      const publicPosts = [...posts.values()]
        .filter((post) => post.status === "PUBLISHED")
        .sort((a, b) => b.published_at.localeCompare(a.published_at))
        .map(toPublicPost);
      sendJson(response, 200, { posts: publicPosts });
      return;
    }

    const postMatch = url.pathname.match(/^\/posts\/([^/]+)$/);
    if (request.method === "GET" && postMatch?.[1]) {
      const post = posts.get(decodeURIComponent(postMatch[1]));
      if (!post || post.status !== "PUBLISHED") {
        sendJson(response, 404, { error: "not_found" });
        return;
      }
      sendJson(response, 200, { post: toPublicPost(post) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin/posts") {
      const adminPosts = [...posts.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      sendJson(response, 200, { posts: adminPosts });
      return;
    }

    const removeMatch = url.pathname.match(/^\/admin\/posts\/([^/]+)\/remove$/);
    if (request.method === "POST" && removeMatch?.[1]) {
      const id = decodeURIComponent(removeMatch[1]);
      const post = posts.get(id);
      if (!post) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      posts.set(id, { ...post, status: "REMOVED", updated_at: new Date().toISOString() });
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/dev/yarly") {
      const body = await readJson<{
        subject?: string;
        bodyText?: string;
        bodyHtml?: string;
        imageUrls?: string[];
      }>(request);

      if ((body.subject || "").trim() !== yarlyPassword) {
        sendJson(response, 403, { error: "invalid_subject_password" });
        return;
      }

      const post = createPost({
        bodyText: body.bodyText || "Local yarly post",
        bodyHtml: body.bodyHtml,
        imageUrls: body.imageUrls || []
      });
      posts.set(post.message_id, post);
      sendJson(response, 201, { post: toPublicPost(post) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/dev/reset") {
      posts.clear();
      seedPost();
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "internal_error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local Meekmail API listening on http://127.0.0.1:${port}`);
  console.log(`Use subject "${yarlyPassword}" with POST /dev/yarly to simulate an accepted yarly email.`);
});

function seedPost() {
  const post = createPost({
    bodyText: "Local test post\nThis post is served by the local in-memory API.",
    bodyHtml: "<p>Local test post</p><p>This post is served by the local in-memory API.</p>",
    imageUrls: [sampleImage]
  });
  posts.set(post.message_id, post);
}

function createPost(params: { bodyText: string; bodyHtml?: string; imageUrls: string[] }): StoredPost {
  const now = new Date().toISOString();
  const id = randomUUID();
  const images: StoredImage[] = params.imageUrls.map((url, index) => ({
    id: `${id}-image-${index + 1}`,
    url,
    key: `local/${id}/${index + 1}`,
    contentType: url.startsWith("data:image/svg") ? "image/svg+xml" : "image/unknown",
    size: 0,
    filename: `local-${index + 1}`
  }));

  return {
    message_id: id,
    status: "PUBLISHED",
    title: deriveTitle(params.bodyText),
    body_text: params.bodyText,
    body_html: params.bodyHtml,
    images,
    from_text: "Local Tester <local@example.test>",
    from_address: "local@example.test",
    raw_s3_bucket: "local",
    raw_s3_key: `local/${id}.eml`,
    published_at: now,
    created_at: now,
    updated_at: now
  };
}

function setCors(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}
