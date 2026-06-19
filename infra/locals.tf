locals {
  zone_id = var.enable_domain_resources ? (
    var.create_route53_zone ? aws_route53_zone.main[0].zone_id : (
      var.route53_zone_id != null ? var.route53_zone_id : data.aws_route53_zone.selected[0].zone_id
    )
  ) : null

  app_name        = "meekmail"
  yarly_email     = "${var.yarly_local_part}@${var.domain_name}"
  forwarder_email = "${var.forwarder_local_part}@${var.domain_name}"
  api_domain      = "api.${var.domain_name}"
  assets_origin   = "https://${aws_cloudfront_distribution.assets.domain_name}"
  api_base_url    = var.enable_domain_resources ? "https://${local.api_domain}" : aws_apigatewayv2_stage.default.invoke_url

  localhost_frontend_urls = ["http://localhost:5173"]
  domain_frontend_urls = var.enable_domain_resources ? [
    "https://${var.domain_name}",
    "https://www.${var.domain_name}"
  ] : []
  frontend_urls = concat(local.localhost_frontend_urls, local.domain_frontend_urls)
}
