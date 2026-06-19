resource "aws_secretsmanager_secret" "yarly_password" {
  name        = var.secret_name
  description = "Subject password required for yarly@ auto-publishing"
}
