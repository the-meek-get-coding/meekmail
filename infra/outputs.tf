output "route53_zone_id" {
  value = local.zone_id
}

output "route53_name_servers" {
  value = var.enable_domain_resources && var.create_route53_zone ? aws_route53_zone.main[0].name_servers : []
}

output "site_url" {
  value = var.enable_domain_resources ? "https://${var.domain_name}" : (
    var.enable_amplify ? "https://${var.amplify_branch}.${aws_amplify_app.frontend[0].default_domain}" : "http://127.0.0.1:5173"
  )
}

output "api_url" {
  value = local.api_base_url
}

output "assets_url" {
  value = local.assets_origin
}

output "raw_email_bucket" {
  value = aws_s3_bucket.raw_email.bucket
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.bucket
}

output "yarly_address" {
  value = var.enable_domain_resources ? local.yarly_email : null
}

output "yarly_secret_name" {
  value = aws_secretsmanager_secret.yarly_password.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.admins.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.admin_spa.id
}

output "amplify_dns_records" {
  value = var.enable_domain_resources ? aws_amplify_domain_association.frontend[0].sub_domain : []
}
