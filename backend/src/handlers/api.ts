import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { requiredEnv } from "../config";
import { getPublicPost, listAdminPosts, listPublicPosts, removePost } from "../ddb";
import { json, methodNotAllowed, notFound } from "../http";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const tableName = requiredEnv("MESSAGES_TABLE");
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    if (method === "GET" && path === "/posts") {
      const posts = await listPublicPosts(tableName);
      return json(200, { posts });
    }

    const postMatch = path.match(/^\/posts\/([^/]+)$/);
    if (method === "GET" && postMatch?.[1]) {
      const post = await getPublicPost(tableName, decodeURIComponent(postMatch[1]));
      return post ? json(200, { post }) : notFound();
    }

    if (method === "GET" && path === "/admin/posts") {
      const posts = await listAdminPosts(tableName);
      return json(200, { posts });
    }

    const removeMatch = path.match(/^\/admin\/posts\/([^/]+)\/remove$/);
    if (method === "POST" && removeMatch?.[1]) {
      await removePost(tableName, decodeURIComponent(removeMatch[1]));
      return json(200, { ok: true });
    }

    if (["GET", "POST"].includes(method)) {
      return notFound();
    }

    return methodNotAllowed();
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || error instanceof ResourceNotFoundException) {
      return notFound();
    }

    console.error("API request failed", { method, path, error });
    return json(500, { error: "internal_error" });
  }
}
