-- Backfill any remaining preset rows whose content is freeform text rather than Key: value pairs.
UPDATE prompt_elements
SET
  content = TRIM(content),
  attributes = json_object(
    'name',
    name,
    'prompt',
    TRIM(content)
  )
WHERE type IN ('person', 'scene', 'framing', 'action', 'style')
  AND (attributes IS NULL OR json_valid(attributes) = 0)
  AND TRIM(content) <> '';
