import { config } from "./config";
import type { AdminPost, PublicPost } from "./types";

export async function listPosts(): Promise<PublicPost[]> {
  const data = await request<{ posts: PublicPost[] }>("/posts");
  return data.posts;
}

export async function getPost(id: string): Promise<PublicPost> {
  const data = await request<{ post: PublicPost }>(`/posts/${encodeURIComponent(id)}`);
  return data.post;
}

export async function listAdminPosts(token: string): Promise<AdminPost[]> {
  const data = await request<{ posts: AdminPost[] }>("/admin/posts", { token });
  return data.posts;
}

export async function removePost(id: string, token: string): Promise<void> {
  await request(`/admin/posts/${encodeURIComponent(id)}/remove`, {
    method: "POST",
    token
  });
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string } = {}
): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
