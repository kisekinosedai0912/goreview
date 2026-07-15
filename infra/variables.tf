variable "vercel_api_token" {
  description = "Vercel API token (or set VERCEL_API_TOKEN env var)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "vercel_team" {
  description = "Vercel team slug or id; leave empty for a personal account."
  type        = string
  default     = ""
}

variable "upstash_email" {
  description = "Upstash account email (or set UPSTASH_EMAIL env var)."
  type        = string
  default     = ""
}

variable "upstash_api_key" {
  description = "Upstash management API key (or set UPSTASH_API_KEY env var)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_repo" {
  description = "GitHub repo the Vercel project deploys from (owner/name)."
  type        = string
  default     = "kisekinosedai0912/goreview"
}

variable "app_url" {
  description = "Public URL of the deployment; used in PR comments and check-run links. Leave empty until the first deploy assigns a domain, then set it and re-apply."
  type        = string
  default     = ""
}

variable "redis_region" {
  description = "Primary region for the Upstash Redis snapshot cache."
  type        = string
  default     = "ap-southeast-1"
}

variable "ai_review_model" {
  description = "Current Vercel AI Gateway model used for opt-in review intelligence."
  type        = string
  default     = "openai/gpt-5.6-sol"
}

# --- GitHub App credentials (created manually on github.com; see infra/README.md) ---

variable "github_app_id" {
  description = "GitHub App ID."
  type        = string
  default     = ""
}

variable "github_app_private_key" {
  description = "GitHub App private key PEM (newlines may be escaped as \\n)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_webhook_secret" {
  description = "Webhook secret configured on the GitHub App."
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_client_id" {
  description = "GitHub App OAuth client ID (user sign-in)."
  type        = string
  default     = ""
}

variable "github_client_secret" {
  description = "GitHub App OAuth client secret."
  type        = string
  sensitive   = true
  default     = ""
}
