UPDATE `request_operations`
SET `assignee` = '',
    `assignee_phone` = '',
    `assigned_by` = NULL,
    `assigned_at` = NULL,
    `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `assignee` = '김규웅'
  AND `assignee_account_id` IS NULL;
