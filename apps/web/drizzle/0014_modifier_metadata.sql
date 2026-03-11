-- Phase 1: Add structured metadata to quick_modifiers
-- Adds attribute_key (normalized category), applies_to (preset type scoping),
-- and selection_mode (single vs multi-select) for deterministic prompt compilation.

ALTER TABLE quick_modifiers ADD COLUMN attribute_key TEXT;
ALTER TABLE quick_modifiers ADD COLUMN applies_to TEXT;
ALTER TABLE quick_modifiers ADD COLUMN selection_mode TEXT NOT NULL DEFAULT 'single';

-- Backfill attribute_key by normalizing category (hyphens & spaces → underscores)
UPDATE quick_modifiers SET attribute_key = REPLACE(REPLACE(LOWER(category), '-', '_'), ' ', '_');

-- Backfill applies_to: person attributes
UPDATE quick_modifiers SET applies_to = '["person"]' WHERE attribute_key IN
  ('body_type','gender','ethnicity','height','skin_tone','hair_color','hair_style',
   'eye_color','face_shape','expression','clothing','accessories','makeup',
   'tattoos_piercings','vibe','distinguishing_features','age','breasts');

-- Backfill applies_to: scene attributes
UPDATE quick_modifiers SET applies_to = '["scene"]' WHERE attribute_key IN
  ('setting','time_of_day','weather','season','atmosphere','architecture',
   'vegetation','props','depth','ground_surface');

-- Backfill applies_to: framing attributes
UPDATE quick_modifiers SET applies_to = '["framing"]' WHERE attribute_key IN
  ('shot_type','camera_angle','camera_height','lens','focal_length',
   'depth_of_field','focus_point','camera_movement','composition_rule','aspect_ratio');

-- Backfill applies_to: action attributes
UPDATE quick_modifiers SET applies_to = '["action"]' WHERE attribute_key IN
  ('primary_action','body_position','hand_placement','head_direction',
   'facial_expression','motion_blur','energy_level','interaction');

-- Backfill applies_to: style attributes
UPDATE quick_modifiers SET applies_to = '["style"]' WHERE attribute_key IN
  ('art_medium','brushwork_or_texture','influence_or_era','level_of_detail','key_elements');

-- Cross-schema keys: lighting and color_palette exist in both scene AND style
UPDATE quick_modifiers SET applies_to = '["scene","style"]' WHERE attribute_key IN
  ('lighting','color_palette');

-- Global modifiers (mood, camera, detail, quality) stay NULL — they apply to everything

-- Multi-select categories (categories where multiple selections make sense)
UPDATE quick_modifiers SET selection_mode = 'multi' WHERE attribute_key IN
  ('accessories','props','key_elements','distinguishing_features','tattoos_piercings');

-- Index for fast lookup by attribute_key
CREATE INDEX quick_modifiers_attr_key_idx ON quick_modifiers(attribute_key);
