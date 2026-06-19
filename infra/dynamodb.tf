resource "aws_dynamodb_table" "messages" {
  name                        = "${local.app_name}-messages"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "message_id"
  deletion_protection_enabled = true

  attribute {
    name = "message_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "published_at"
    type = "S"
  }

  global_secondary_index {
    name            = "status-published-at-index"
    hash_key        = "status"
    range_key       = "published_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
}
