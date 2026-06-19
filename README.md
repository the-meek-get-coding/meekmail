# Meekmail

Meekmail is a Terraform-managed AWS email/web stack:

- SES receives mail for `meekmail.com`.
- Known friend addresses are forwarded to Gmail accounts.
- `yarly@meekmail.com` auto-publishes emails whose subject exactly matches a shared password.
- A static Vite React frontend is hosted by Amplify and uses Mantine for UI.
- DynamoDB stores published/removed post metadata, S3 stores raw mail and images, and Cognito protects admin removal.

## Layout

- `frontend/` - Vite React SPA.
- `backend/` - TypeScript Lambda handlers.
- `infra/` - Terraform AWS infrastructure.

## Local setup

```sh
npm install
npm run build
npm test
```

The backend build bundles Lambda handlers into `backend/dist/handlers/*.js`. Run it before Terraform planning or applying.

## Test without the domain

While you do not control `meekmail.com` DNS, keep this in `infra/terraform.tfvars`:

```hcl
enable_domain_resources = false
```

That skips Route 53 records, SES receiving, ACM custom-domain validation, and the Amplify custom domain. Terraform can still create the API, DynamoDB, Lambda functions, Cognito, S3, CloudFront assets, and Amplify app using provider/default URLs.

For fully local UI testing, run:

```sh
npm run dev:local
```

Open `http://127.0.0.1:5173`. The local API starts at `http://127.0.0.1:3000`, uses in-memory posts, and bypasses Cognito with `VITE_DEV_ADMIN=true`.

Simulate a yarly email that has the correct subject password:

```sh
curl -X POST http://127.0.0.1:3000/dev/yarly \
  -H 'content-type: application/json' \
  -d '{"subject":"meek","bodyText":"Hello from local yarly\nThis becomes a post."}'
```

Override the local password with:

```sh
YARLY_DEV_PASSWORD='your-test-password' npm run dev:local
```

## Terraform setup

```sh
cp infra/terraform.tfvars.example infra/terraform.tfvars
# edit domain, repository, aliases, admin emails
npm run build -w backend
terraform -chdir=infra init
terraform -chdir=infra plan
```

After apply:

1. If `enable_domain_resources = true`, delegate the domain registrar to the Route 53 nameservers if Terraform created the hosted zone.
2. If `enable_domain_resources = true`, request SES production access in the SES console. Forwarding to Gmail will not work from the sandbox unless every Gmail recipient is verified.
3. Set the yarly password in Secrets Manager:

```sh
aws secretsmanager put-secret-value \
  --secret-id meekmail/yarly-password \
  --secret-string 'replace-with-shared-password'
```

If you change `secret_name` in Terraform, use the output `yarly_secret_name` instead.

## Email behavior

Friend aliases are defined in `forwarding_aliases` and are exact-match only. There is no catch-all recipient.

For `yarly@meekmail.com`, the email subject must be exactly the shared password. The password is never stored with the post. The public title is derived from the first non-empty body line, with `Untitled` as fallback.

Inline `cid:` images and image attachments are copied to S3, served through CloudFront, and exposed in the post API. Unsupported attachments are ignored.
