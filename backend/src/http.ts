import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body)
  };
}

export function notFound(): APIGatewayProxyStructuredResultV2 {
  return json(404, { error: "not_found" });
}

export function methodNotAllowed(): APIGatewayProxyStructuredResultV2 {
  return json(405, { error: "method_not_allowed" });
}
