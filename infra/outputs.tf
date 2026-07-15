output "vercel_project_id" {
  value = vercel_project.web.id
}

output "redis_endpoint" {
  value = upstash_redis_database.snapshot_cache.endpoint
}

output "redis_rest_url" {
  value = "https://${upstash_redis_database.snapshot_cache.endpoint}"
}

output "redis_rest_token" {
  value     = upstash_redis_database.snapshot_cache.rest_token
  sensitive = true
}

output "webhook_url_hint" {
  value = "Set the GitHub App webhook URL to <deployment-url>/api/webhooks/github once the first deploy is live."
}
