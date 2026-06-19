resource "aws_ses_domain_identity" "domain" {
  count  = var.enable_domain_resources ? 1 : 0
  domain = var.domain_name
}

resource "aws_route53_record" "ses_verification" {
  count   = var.enable_domain_resources ? 1 : 0
  zone_id = local.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.domain[0].verification_token]
}

resource "aws_ses_domain_identity_verification" "domain" {
  count      = var.enable_domain_resources ? 1 : 0
  domain     = aws_ses_domain_identity.domain[0].id
  depends_on = [aws_route53_record.ses_verification]
}

resource "aws_ses_domain_dkim" "domain" {
  count  = var.enable_domain_resources ? 1 : 0
  domain = aws_ses_domain_identity.domain[0].domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = var.enable_domain_resources ? 3 : 0
  zone_id = local.zone_id
  name    = "${aws_ses_domain_dkim.domain[0].dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.domain[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "spf" {
  count   = var.enable_domain_resources ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  count   = var.enable_domain_resources ? 1 : 0
  zone_id = local.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc@${var.domain_name}"]
}

resource "aws_route53_record" "mx" {
  count   = var.enable_domain_resources ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 600
  records = ["10 inbound-smtp.${var.aws_region}.amazonaws.com"]
}

resource "aws_ses_receipt_rule_set" "main" {
  count         = var.enable_domain_resources ? 1 : 0
  rule_set_name = "${local.app_name}-inbound"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  count         = var.enable_domain_resources ? 1 : 0
  rule_set_name = aws_ses_receipt_rule_set.main[0].rule_set_name
}

resource "aws_ses_receipt_rule" "yarly" {
  count         = var.enable_domain_resources ? 1 : 0
  name          = "yarly"
  rule_set_name = aws_ses_receipt_rule_set.main[0].rule_set_name
  recipients    = [local.yarly_email]
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Optional"

  lambda_action {
    function_arn    = aws_lambda_function.yarly_gate.arn
    invocation_type = "RequestResponse"
    position        = 1
  }

  s3_action {
    bucket_name       = aws_s3_bucket.raw_email.bucket
    object_key_prefix = "yarly/"
    position          = 2
  }

  lambda_action {
    function_arn    = aws_lambda_function.yarly_processor.arn
    invocation_type = "Event"
    position        = 3
  }

  depends_on = [
    aws_lambda_permission.ses_yarly_gate,
    aws_lambda_permission.ses_yarly_processor,
    aws_s3_bucket_policy.raw_email
  ]
}

resource "aws_ses_receipt_rule" "forward" {
  for_each      = var.enable_domain_resources ? var.forwarding_aliases : {}
  name          = substr(replace(replace(replace(each.key, "@", "-at-"), ".", "-"), "+", "-"), 0, 64)
  rule_set_name = aws_ses_receipt_rule_set.main[0].rule_set_name
  recipients    = [each.key]
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Optional"

  s3_action {
    bucket_name       = aws_s3_bucket.raw_email.bucket
    object_key_prefix = "forward/"
    position          = 1
  }

  lambda_action {
    function_arn    = aws_lambda_function.forwarder.arn
    invocation_type = "Event"
    position        = 2
  }

  depends_on = [
    aws_lambda_permission.ses_forwarder,
    aws_s3_bucket_policy.raw_email
  ]
}
