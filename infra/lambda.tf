data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/dist"
  output_path = "${path.module}/backend.zip"
}

locals {
  lambda_zip_hash = data.archive_file.backend.output_base64sha256
}

resource "aws_cloudwatch_log_group" "forwarder" {
  name              = "/aws/lambda/${local.app_name}-forwarder"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "yarly_gate" {
  name              = "/aws/lambda/${local.app_name}-yarly-gate"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "yarly_processor" {
  name              = "/aws/lambda/${local.app_name}-yarly-processor"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.app_name}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "forwarder" {
  function_name    = "${local.app_name}-forwarder"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.backend.output_path
  source_code_hash = local.lambda_zip_hash
  handler          = "handlers/forwarder.handler"
  runtime          = "nodejs22.x"
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      RAW_EMAIL_BUCKET   = aws_s3_bucket.raw_email.bucket
      RAW_FORWARD_PREFIX = "forward/"
      FORWARDING_ALIASES = jsonencode(var.forwarding_aliases)
      FORWARDER_FROM     = "Meekmail Forwarder <${local.forwarder_email}>"
    }
  }

  depends_on = [aws_cloudwatch_log_group.forwarder]
}

resource "aws_lambda_function" "yarly_gate" {
  function_name    = "${local.app_name}-yarly-gate"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.backend.output_path
  source_code_hash = local.lambda_zip_hash
  handler          = "handlers/yarly-gate.handler"
  runtime          = "nodejs22.x"
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      YARLY_SECRET_ID = aws_secretsmanager_secret.yarly_password.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.yarly_gate]
}

resource "aws_lambda_function" "yarly_processor" {
  function_name    = "${local.app_name}-yarly-processor"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.backend.output_path
  source_code_hash = local.lambda_zip_hash
  handler          = "handlers/yarly-processor.handler"
  runtime          = "nodejs22.x"
  timeout          = 60
  memory_size      = 1024

  environment {
    variables = {
      RAW_EMAIL_BUCKET = aws_s3_bucket.raw_email.bucket
      RAW_YARLY_PREFIX = "yarly/"
      ASSETS_BUCKET    = aws_s3_bucket.assets.bucket
      ASSETS_BASE_URL  = local.assets_origin
      MESSAGES_TABLE   = aws_dynamodb_table.messages.name
      YARLY_SECRET_ID  = aws_secretsmanager_secret.yarly_password.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.yarly_processor]
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.app_name}-api"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.backend.output_path
  source_code_hash = local.lambda_zip_hash
  handler          = "handlers/api.handler"
  runtime          = "nodejs22.x"
  timeout          = 15
  memory_size      = 512

  environment {
    variables = {
      MESSAGES_TABLE = aws_dynamodb_table.messages.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_lambda_permission" "ses_forwarder" {
  statement_id   = "AllowExecutionFromSESForwarder"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.forwarder.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "ses_yarly_gate" {
  statement_id   = "AllowExecutionFromSESYarlyGate"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.yarly_gate.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "ses_yarly_processor" {
  statement_id   = "AllowExecutionFromSESYarlyProcessor"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.yarly_processor.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}
