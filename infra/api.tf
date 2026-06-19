resource "aws_acm_certificate" "api" {
  count             = var.enable_domain_resources ? 1 : 0
  domain_name       = local.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = var.enable_domain_resources ? {
    for dvo in aws_acm_certificate.api[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "api" {
  count                   = var.enable_domain_resources ? 1 : 0
  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

resource "aws_cognito_user_pool" "admins" {
  name = "${local.app_name}-admins"

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }
}

resource "aws_cognito_user_pool_domain" "admins" {
  domain       = "${local.app_name}-admin-${random_id.suffix.hex}"
  user_pool_id = aws_cognito_user_pool.admins.id
}

resource "aws_cognito_user_pool_client" "admin_spa" {
  name         = "${local.app_name}-admin-spa"
  user_pool_id = aws_cognito_user_pool.admins.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = distinct(concat([for url in local.frontend_urls : "${url}/admin/callback"], ["${var.frontend_redirect_url}/admin/callback"]))
  logout_urls                          = distinct(concat([for url in local.frontend_urls : "${url}/admin"], ["${var.frontend_redirect_url}/admin"]))
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_user" "admins" {
  for_each     = toset(var.admin_emails)
  user_pool_id = aws_cognito_user_pool.admins.id
  username     = each.value

  attributes = {
    email          = each.value
    email_verified = "true"
  }

  desired_delivery_mediums = ["EMAIL"]
}

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.app_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = local.frontend_urls
    max_age           = 3600
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-admins"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.admin_spa.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admins.id}"
  }
}

resource "aws_apigatewayv2_route" "list_posts" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /posts"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_route" "get_post" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /posts/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_route" "admin_posts" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/posts"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "remove_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /admin/posts/{id}/remove"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_domain_name" "api" {
  count       = var.enable_domain_resources ? 1 : 0
  domain_name = local.api_domain

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api[0].certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  count       = var.enable_domain_resources ? 1 : 0
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "api" {
  count   = var.enable_domain_resources ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
