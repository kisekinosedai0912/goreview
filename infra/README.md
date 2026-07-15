# goreview infra

Terraform for everything the hosted app needs:

- **Vercel project** — deploys `apps/web` (Next.js) from this repo, with
  `turbo-ignore` so pushes that don't touch the app skip builds.
- **Upstash Redis** — snapshot cache (`UPSTASH_REDIS_REST_URL` / `_TOKEN`).
- **Env vars** — cache credentials, a generated `SESSION_SECRET`, and the
  GitHub App credentials once you have them.
- **Review Intelligence config** — the non-secret, currently supported
  AI Gateway model ID. Gateway credentials are deliberately not managed by
  Terraform.

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
4. Enable **AI Gateway** in the Vercel project settings. Vercel deployments
   receive short-lived OIDC credentials automatically; there is no provider
   API key to put in Terraform.

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

## Local Review Intelligence

Link the app to the Terraform-created Vercel project, then pull development
variables and a short-lived Gateway OIDC token:

```sh
cd apps/web
vercel link --yes --project goreview
vercel env pull .env.local --yes --environment=development
pnpm dev
```

`vercel env pull` replaces `.env.local`. Keep personal overrides in
`.env.development.local`, and re-run the pull when the OIDC token expires.
Do not add `VERCEL_OIDC_TOKEN`, `AI_GATEWAY_API_KEY`, or provider keys to
Terraform variables/state.

The configured default, `openai/gpt-5.6-sol`, was checked against the live
Gateway catalog during implementation. Override `ai_review_model` only with a
currently listed `provider/model` ID.

AI is explicitly opt-in in the review UI. Until a reviewer clicks Generate or
Explain, private code stays in the app and only deterministic local facts are
shown. Prompts contain bounded changed hunks and relationship facts, not a full
repository, and generated text is never posted to GitHub automatically.

## OAuth write requirements

Inline comments are immediate GitHub review comments attributed to the signed-in
reviewer. Keep the GitHub App's **Pull requests: read/write** permission enabled.
The server intentionally refuses to write reviewer comments with an installation
token. For local development without OAuth, `GITHUB_TOKEN` must be a user token
with repository access and pull-request read/write permission.
