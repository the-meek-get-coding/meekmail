import { GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamo } from "./aws";
import type { PublicPost, StoredPost } from "./types";

const STATUS_INDEX = "status-published-at-index";

export async function putPost(tableName: string, post: StoredPost): Promise<void> {
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(post, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(message_id)"
    })
  );
}

export async function getPublicPost(tableName: string, id: string): Promise<PublicPost | undefined> {
  const response = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ message_id: id })
    })
  );

  if (!response.Item) {
    return undefined;
  }

  const post = unmarshall(response.Item) as StoredPost;
  return post.status === "PUBLISHED" ? toPublicPost(post) : undefined;
}

export async function listPublicPosts(tableName: string, limit = 50): Promise<PublicPost[]> {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: STATUS_INDEX,
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: marshall({
        ":status": "PUBLISHED"
      }),
      ScanIndexForward: false,
      Limit: limit
    })
  );

  return (response.Items || []).map((item) => toPublicPost(unmarshall(item) as StoredPost));
}

export async function listAdminPosts(tableName: string, limit = 100): Promise<StoredPost[]> {
  const response = await dynamo.send(
    new ScanCommand({
      TableName: tableName,
      Limit: limit
    })
  );

  return (response.Items || [])
    .map((item) => unmarshall(item) as StoredPost)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function removePost(tableName: string, id: string): Promise<void> {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ message_id: id }),
      UpdateExpression: "SET #status = :removed, updated_at = :now",
      ConditionExpression: "attribute_exists(message_id)",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: marshall({
        ":removed": "REMOVED",
        ":now": now
      })
    })
  );
}

export function toPublicPost(post: StoredPost): PublicPost {
  return {
    id: post.message_id,
    title: post.title,
    bodyText: post.body_text,
    bodyHtml: post.body_html,
    images: post.images || [],
    from: post.from_text,
    publishedAt: post.published_at
  };
}
