aws_region  = "us-west-1"
domain_name = "meekmail.com"

# Temporary: skip all resources that require meekmail.com DNS control.
enable_domain_resources = false
enable_amplify          = true

# If the registrar is already delegated to an existing Route 53 zone, set:
# create_route53_zone = false
# route53_zone_id     = "Z..."

amplify_repository_url = "https://github.com/the-meek-get-coding/meekmail"
amplify_branch         = "main"

admin_emails = [
  "bogdanyr4@gmail.com"
]

forwarding_aliases = {
  "bogdan@meekmail.com" = ["bogdanyr4@gmail.com"]
  "themeek@meekmail.com" = [
    "bogdanyr4@gmail.com",
  ]
}
