import type { SESEvent } from "aws-lambda";
import { requiredEnv } from "../config";
import { subjectMatchesPassword } from "../email";
import { getSecretString } from "../secrets";

export async function handler(event: SESEvent): Promise<{ disposition: "CONTINUE" | "STOP_RULE_SET" }> {
  const secretId = requiredEnv("YARLY_SECRET_ID");
  const password = await getSecretString(secretId);
  const record = event.Records[0];
  const subject = record?.ses.mail.commonHeaders?.subject;

  if (!subjectMatchesPassword(subject, password)) {
    return { disposition: "STOP_RULE_SET" };
  }

  return { disposition: "CONTINUE" };
}
