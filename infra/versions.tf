terraform {
  required_version = ">= 1.6.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "vercel" {
  # Reads VERCEL_API_TOKEN from the environment when api_token is unset.
  api_token = var.vercel_api_token != "" ? var.vercel_api_token : null
  team      = var.vercel_team != "" ? var.vercel_team : null
}

provider "upstash" {
  # Reads UPSTASH_EMAIL / UPSTASH_API_KEY from the environment when unset.
  email   = var.upstash_email != "" ? var.upstash_email : null
  api_key = var.upstash_api_key != "" ? var.upstash_api_key : null
}
