resource "aws_amplify_app" "frontend" {
  count        = var.enable_amplify ? 1 : 0
  name         = local.app_name
  repository   = var.amplify_repository_url
  access_token = var.amplify_access_token
  platform     = "WEB"

  build_spec = <<-YAML
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build -w frontend
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - frontend/node_modules/**/*
          - backend/node_modules/**/*
  YAML

  environment_variables = {
    VITE_API_BASE_URL         = local.api_base_url
    VITE_COGNITO_AUTHORITY    = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admins.id}"
    VITE_COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.admin_spa.id
    VITE_COGNITO_REDIRECT_URI = var.enable_domain_resources ? "https://${var.domain_name}/admin/callback" : "http://localhost:5173/admin/callback"
  }

  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }
}

resource "aws_amplify_branch" "main" {
  count       = var.enable_amplify ? 1 : 0
  app_id      = aws_amplify_app.frontend[0].id
  branch_name = var.amplify_branch
  framework   = "React"
  stage       = "PRODUCTION"
}

resource "aws_amplify_domain_association" "frontend" {
  count       = var.enable_amplify && var.enable_domain_resources ? 1 : 0
  app_id      = aws_amplify_app.frontend[0].id
  domain_name = var.domain_name

  sub_domain {
    branch_name = aws_amplify_branch.main[0].branch_name
    prefix      = ""
  }

  sub_domain {
    branch_name = aws_amplify_branch.main[0].branch_name
    prefix      = "www"
  }
}
