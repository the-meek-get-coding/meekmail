import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SESv2Client } from "@aws-sdk/client-sesv2";

export const dynamo = new DynamoDBClient({});
export const s3 = new S3Client({});
export const secrets = new SecretsManagerClient({});
export const ses = new SESv2Client({});
