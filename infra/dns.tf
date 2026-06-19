resource "aws_route53_zone" "main" {
  count = var.enable_domain_resources && var.create_route53_zone ? 1 : 0
  name  = var.domain_name
}

data "aws_route53_zone" "selected" {
  count        = var.enable_domain_resources && !var.create_route53_zone && var.route53_zone_id == null ? 1 : 0
  name         = var.domain_name
  private_zone = false
}
