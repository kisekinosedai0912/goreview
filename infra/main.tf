// Snapshot cache. Global replication is unnecessary for a cache; a
// single-region free-tier database keeps latency fine and cost at zero.
resource "upstash_redis_database" "snapshot_cache" {
  database_name = "goreview-snapshots"
  region        = var.redis_region
  tls           = true
  eviction      = true
}

// Session cookie encryption key; generated once and kept in state.
resource "random_password" "session_secret" {
  length  = 48
  special = false
}

locals {
  // GitHub App env vars are optional at first apply (the app is created
  // manually on github.com); only push the ones that have values.
  github_app_env = {
    GITHUB_APP_ID          = var.github_app_id
    GITHUB_APP_PRIVATE_KEY = var.github_app_private_key
    GITHUB_WEBHOOK_SECRET  = var.github_webhook_secret
    GITHUB_CLIENT_ID       = var.github_client_id
    GITHUB_CLIENT_SECRET   = var.github_client_secret
  }
  present_github_app_env = { for k, v in local.github_app_env : k => v if v != "" }
}

resource "vercel_project" "web" {
  name      = "goreview"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  root_directory = "apps/web"

  // Monorepo: skip builds when neither the app nor its workspace deps changed.
  ignore_command = "npx turbo-ignore @goreview/web"
}

resource "vercel_project_environment_variables" "web" {
  project_id = vercel_project.web.id

  variables = concat(
    [
      {
        key       = "UPSTASH_REDIS_REST_URL"
        value     = "https://${upstash_redis_database.snapshot_cache.endpoint}"
        target    = ["production", "preview"]
        sensitive = false
      },
      {
        key       = "UPSTASH_REDIS_REST_TOKEN"
        value     = upstash_redis_database.snapshot_cache.rest_token
        target    = ["production", "preview"]
        sensitive = true
      },
      {
        key       = "SESSION_SECRET"
        value     = random_password.session_secret.result
        target    = ["production", "preview"]
        sensitive = true
      },
    ],
    var.app_url != "" ? [
      {
        key       = "APP_URL"
        value     = var.app_url
        target    = ["production"]
        sensitive = false
      },
    ] : [],
    [
      for key, value in local.present_github_app_env : {
        key       = key
        value     = value
        target    = ["production", "preview"]
        sensitive = true
      }
    ],
  )
}
