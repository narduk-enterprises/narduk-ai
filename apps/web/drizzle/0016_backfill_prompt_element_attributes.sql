-- Backfill structured preset attributes JSON from legacy "Key: value" content blocks.
WITH RECURSIVE
  target_rows AS (
    SELECT id, content
    FROM prompt_elements
    WHERE type IN ('person', 'scene', 'framing', 'action', 'style')
      AND (attributes IS NULL OR trim(attributes) = '' OR json_valid(attributes) = 0)
  ),
  split_lines(id, remainder, line) AS (
    SELECT id, content || char(10), ''
    FROM target_rows
    UNION ALL
    SELECT
      id,
      substr(remainder, instr(remainder, char(10)) + 1),
      trim(substr(remainder, 1, instr(remainder, char(10)) - 1))
    FROM split_lines
    WHERE remainder <> ''
  ),
  pairs AS (
    SELECT
      id,
      lower(replace(trim(substr(line, 1, instr(line, ':') - 1)), ' ', '_')) AS key,
      trim(substr(line, instr(line, ':') + 1)) AS value
    FROM split_lines
    WHERE instr(line, ':') > 0
  ),
  normalized_pairs AS (
    SELECT id, key, value
    FROM pairs
    WHERE key <> '' AND value <> ''
  ),
  json_by_row AS (
    SELECT id, json_group_object(key, value) AS attributes_json
    FROM normalized_pairs
    GROUP BY id
  )
UPDATE prompt_elements
SET attributes = (
  SELECT attributes_json
  FROM json_by_row
  WHERE json_by_row.id = prompt_elements.id
)
WHERE id IN (SELECT id FROM json_by_row);
