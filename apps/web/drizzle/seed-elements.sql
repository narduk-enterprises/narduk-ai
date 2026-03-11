-- Seed data: Prompt Element presets for local development
-- Run: pnpm run db:seed:elements (after db:migrate)
-- Safe to re-run (INSERT OR IGNORE with stable UUIDs)

-- ─── Persons ────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, metadata, created_at, updated_at)
VALUES
  ('e0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'person',
   'Jessica',
   'Name: Jessica
Description: Charming Sorority Belle
Age: 22
Gender: Female
Ethnicity: Caucasian
Body type: slender and fit
Height: 5''6"
Skin tone: lightly tanned
Hair color: blonde
Hair style: long, wavy
Eye color: blue
Face shape: oval
Expression: smiling, approachable
Clothing: casual sundress
Accessories: pearl necklace and hoop earrings
Makeup: light with lip gloss
Tattoos piercings: ear piercings
Vibe: playful and charming
Distinguishing features: dimples',
   '{"headshotUrl":"/presets/jessica_headshot_1773209387523.png","fullBodyUrl":"/presets/jessica_fullbody_1773209399523.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'person',
   'Lola Lux',
   'Name: Lola Lux
Description: Slender Alluring Beauty
Age: 25
Gender: female
Ethnicity: Caucasian
Body type: Slender and fit
Height: 5''6"
Skin tone: Fair
Hair color: Blonde
Hair style: Long waves
Eye color: Green
Face shape: Oval
Expression: Smiling
Clothing: Stylish dress
Accessories: Hoop earrings
Makeup: Bold lipstick
Tattoos piercings: Ear piercings
Vibe: Confident and alluring
Distinguishing features: Piercing eyes',
   '{"headshotUrl":"/presets/lola_headshot_1773209411743.png","fullBodyUrl":"/presets/lola_fullbody_1773209423931.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'person',
   'Emily Parker',
   'Name: Emily Parker
Description: Friendly Everyday Girl
Age: 25
Gender: Female
Ethnicity: Caucasian
Body type: Slender and flat-chested
Height: 5''6"
Skin tone: Fair
Hair color: Brown
Hair style: Long and straight
Eye color: Blue
Face shape: Oval
Expression: Friendly and approachable
Clothing: Casual jeans and t-shirt
Accessories: Simple necklace
Makeup: None
Tattoos piercings: None
Vibe: Warm and relatable
Distinguishing features: Freckles on cheeks',
   '{"headshotUrl":"/presets/emily_headshot_1773209437733.png","fullBodyUrl":"/presets/emily_fullbody_1773209451616.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Scenes ────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, metadata, created_at, updated_at)
VALUES
  ('e0000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'scene',
   'Vibrant Jungle Oasis',
   'Name: Vibrant Jungle Oasis
Description: Lush Exotic Haven
Setting: Tropical Jungle
Time of day: Midday
Weather: Sunny and Warm
Season: Summer
Lighting: Bright Sunlight Filtering
Color palette: Vibrant Greens Blues
Architecture: Ancient Stone Temples
Vegetation: Dense Ferns and Vines
Props: Rustic Wooden Idols, Flowering Plants
Atmosphere: Adventurous and Energetic
Depth: Layered with Distant Mountains
Ground surface: Mossy Forest Floor',
   '{"fullBodyUrl":"/presets/scene_jungle_1773209465437.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'scene',
   'Rainy City Rooftop',
   'Name: Rainy City Rooftop
Description: Wet Urban Perch
Setting: High urban rooftop
Time of day: Dusk
Weather: Heavy rain
Season: Autumn
Lighting: Flickering neon lights
Color palette: Grays and blues
Architecture: Sleek modern skyscrapers
Vegetation: Sparse potted ferns
Props: Rusted vents, puddles
Atmosphere: Moody and isolated
Depth: Layered city skyline
Ground surface: Slippery wet concrete',
   '{"fullBodyUrl":"/presets/scene_rooftop_1773209481094.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000002-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'scene',
   'Sunny Bahamas Shore',
   'Name: Sunny Bahamas Shore
Description: Vibrant Tropical Beach
Setting: Coastal island paradise
Time of day: Midday brightness
Weather: Clear sunny skies
Season: Summer warmth
Lighting: Bright natural sun
Color palette: Aqua blues and sands
Architecture: Thatched palm huts
Vegetation: Lush palm groves
Props: Lounge chairs and shells
Atmosphere: Relaxed serene escape
Depth: Layered ocean horizon
Ground surface: Soft white sand',
   '{"fullBodyUrl":"/presets/scene_bahamas_1773209495445.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Framings ────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, metadata, created_at, updated_at)
VALUES
  ('e0000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'framing',
   'Epic Landscape View',
   'Name: Epic Landscape View
Description: Vast Horizon Drama
Shot type: wide shot
Camera angle: eye level
Camera height: ground level
Lens: wide-angle
Focal length: 24mm
Depth of field: deep
Focus point: horizon
Camera movement: static
Composition rule: rule of thirds
Aspect ratio: 16:9',
   '{"fullBodyUrl":"/presets/hero_landscape_1773209526375.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000003-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'framing',
   'Epic Hero Framing',
   'Name: Epic Hero Framing
Description: Bold Action Vista
Shot type: Wide Shot
Camera angle: Low Angle
Camera height: Knee Level
Lens: Wide-Angle
Focal length: 24mm
Depth of field: Deep
Focus point: Central Character
Camera movement: Slow Pan
Composition rule: Rule of Thirds
Aspect ratio: 2.35:1',
   '{"fullBodyUrl":"/presets/hero_epic_1773209509717.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'framing',
   'Epic Landscape View',
   'Name: Epic Landscape View
Description: Vast Horizon Epic
Shot type: wide shot
Camera angle: eye level
Camera height: ground level
Lens: wide-angle
Focal length: 24mm
Depth of field: deep
Focus point: horizon
Camera movement: static
Composition rule: rule of thirds
Aspect ratio: 16:9',
   '{"fullBodyUrl":"/presets/hero_landscape_1773209526375.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Actions ────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, metadata, created_at, updated_at)
VALUES
  ('e0000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'action',
   'Epic Sword Swing',
   'Name: Epic Sword Swing
Description: Fierce Blade Strike
Primary action: Swinging a sword
Body position: Balanced combat stance
Hand placement: Gripped on handle
Head direction: Facing forward
Facial expression: Determined grimace
Motion blur: High for speed
Energy level: High intensity
Interaction: Engaging enemy
Emotion: Fierce determination',
   '{"fullBodyUrl":"/presets/action_sword_1773209540311.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'action',
   'Diving into Water',
   'Name: Diving into Water
Description: Graceful Water Dive
Primary action: diving headfirst
Body position: arched mid-air pose
Hand placement: arms extended forward
Head direction: downward towards water
Facial expression: concentrated focus
Motion blur: moderate splash effect
Energy level: high dynamic
Interaction: with pool surface
Emotion: thrilling excitement',
   '{"fullBodyUrl":"/presets/action_dive_1773209556601.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'action',
   'Heroic Sword Strike',
   'Name: Heroic Sword Strike
Description: Bold Sword Swing
Primary action: Swinging a sword
Body position: Forward lunge
Hand placement: Gripping hilt tightly
Head direction: Facing opponent
Facial expression: Determined grimace
Motion blur: High
Energy level: High
Interaction: Engaging enemy
Emotion: Courageous',
   '{"fullBodyUrl":"/presets/heroic_sword_1773209583045.png"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
