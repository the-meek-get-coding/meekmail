import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { secrets } from "./aws";

const cache = new Map<string, string>();

export async function getSecretString(secretId: string): Promise<string> {
  const cached = cache.get(secretId);
  if (cached) {
    return cached;
  }

  const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} does not contain a string value`);
  }

  cache.set(secretId, response.SecretString);
  return response.SecretString;
}
