# goreview infra

Terraform for everything the hosted app needs:

- **Vercel project** — deploys `apps/web` (Next.js) from this repo, with
  `turbo-ignore` so pushes that don't touch the app skip builds.
- **Upstash Redis** — snapshot cache (`UPSTASH_REDIS_REST_URL` / `_TOKEN`).
- **Env vars** — cache credentials, a generated `SESSION_SECRET`, and the
  GitHub App credentials once you have them.

## Prereqs

1. A Vercel API token: <https://vercel.com/account/settings/tokens>
2. An Upstash management API key: <https://console.upstash.com/account/api>
3. A GitHub App (manual, one time — GitHub has no Terraform resource for
   creating Apps): <https://github.com/settings/apps/new>
   - Webhook URL: `https://<your-deployment>/api/webhooks/github` (fill in
     after the first deploy; use a placeholder initially)
   - Webhook secret: any random string, goes into `github_webhook_secret`
   - Permissions: **Checks: read/write**, **Pull requests: read/write**,
     **Contents: read**, **Metadata: read**
   - Subscribe to events: **Pull request**
   - Enable "Request user authorization (OAuth) during installation",
     callback URL `https://<your-deployment>/api/auth/callback`
   - Generate a private key and a client secret

## Usage

```sh
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill it in
terraform init
terraform apply
```

After the first deploy gets its URL, set `app_url` in `terraform.tfvars`
and re-apply so PR comments and check runs link to the hosted review. Then
point the GitHub App's webhook URL at `<url>/api/webhooks/github`.

State is local (`terraform.tfstate`, gitignored) and contains secrets —
don't commit it.
