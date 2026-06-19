variable "aws_region" {
  description = "AWS region for SES inbound, Lambda, DynamoDB, API Gateway, and Amplify."
  type        = string
  default     = "us-west-1"
}

variable "domain_name" {
  description = "Root domain for the site and email."
  type        = string
  default     = "meekmail.com"
}

variable "enable_domain_resources" {
  description = "Whether to create resources that require control of domain DNS: Route 53 records, SES receiving, ACM/API custom domain, and Amplify custom domain."
  type        = bool
  default     = true
}

variable "create_route53_zone" {
  description = "Whether Terraform should create the public Route 53 hosted zone."
  type        = bool
  default     = true
}

variable "route53_zone_id" {
  description = "Existing Route 53 hosted zone ID when create_route53_zone is false. If null, Terraform looks it up by domain."
  type        = string
  default     = null
}

variable "amplify_repository_url" {
  description = "Git repository URL for Amplify Hosting. Leave null to create the app without connecting a repo."
  type        = string
  default     = null
}

variable "enable_amplify" {
  description = "Whether to create the Amplify Hosting app. Disable this for backend-only/domainless testing."
  type        = bool
  default     = true
}

variable "amplify_access_token" {
  description = "GitHub access token for Amplify repository access, if needed."
  type        = string
  sensitive   = true
  default     = null
}

variable "amplify_branch" {
  description = "Amplify branch to build."
  type        = string
  default     = "main"
}

variable "forwarding_aliases" {
  description = "Exact meekmail recipient to external forwarding targets."
  type        = map(list(string))
  default     = {}
}

variable "admin_emails" {
  description = "Initial Cognito admin users to create."
  type        = list(string)
  default     = []
}

variable "yarly_local_part" {
  description = "Local part for the auto-published address."
  type        = string
  default     = "yarly"
}

variable "forwarder_local_part" {
  description = "Local part used as the rewritten From address for forwarded mail."
  type        = string
  default     = "forwarder"
}

variable "raw_email_retention_days" {
  description = "Retention period for private raw email objects."
  type        = number
  default     = 365
}

variable "secret_name" {
  description = "Secrets Manager secret name for the yarly subject password."
  type        = string
  default     = "meekmail/yarly-password"
}
