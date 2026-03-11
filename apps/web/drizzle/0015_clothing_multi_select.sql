-- Fix: Set clothing and makeup to multi-select mode.
-- These were incorrectly left as 'single' in 0014, causing the second
-- selection to evict the first (e.g. picking "bottoms" then "top" would
-- drop "bottoms").
UPDATE quick_modifiers SET selection_mode = 'multi' WHERE attribute_key IN
  ('clothing', 'makeup', 'breasts');
