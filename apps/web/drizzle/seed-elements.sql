-- Seed data: Prompt Element presets for local development
-- Run: pnpm run db:seed:elements (after db:migrate)
-- Safe to re-run (INSERT OR IGNORE with stable UUIDs)

-- ─── Persons ──────────────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, created_at, updated_at)
VALUES
  ('e0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'person',
   'Cyberpunk Hacker',
   'A young woman in her mid-20s with short neon-blue undercut hair, cybernetic eye implant glowing amber, wearing a weathered black leather jacket covered in holographic patches, fingerless gloves revealing circuit-tattoo forearms, confident smirk, sharp cheekbones, industrial ear piercings',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'person',
   'Fantasy Ranger',
   'A tall, weathered elven ranger with long silver hair partially braided, deep green eyes, angular features with a thin scar across the left cheek, wearing an earth-toned hooded cloak over dark leather armor, a hand-carved longbow slung across the back, quiet intensity in the gaze',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'person',
   'Noir Detective',
   'A middle-aged man with a square jaw, perpetual five-o-clock shadow, deep-set tired eyes, wearing a rumpled charcoal grey overcoat over a loosened tie and white dress shirt, fedora tilted slightly forward casting shadow over the brow, cigarette smoke curling upward, world-weary posture',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Scenes ───────────────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, created_at, updated_at)
VALUES
  ('e0000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'scene',
   'Neon-Lit Alley',
   'A narrow rain-slicked alley in a dense cyberpunk megacity at night, neon signs in Japanese and Korean reflecting off wet pavement in streaks of magenta and teal, steam rising from grated vents, tangled power cables overhead, distant holographic billboards, moody atmospheric fog',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'scene',
   'Enchanted Forest Clearing',
   'A sun-dappled clearing in an ancient forest, massive moss-covered oak trees with bioluminescent fungi growing on bark, soft golden light filtering through the canopy, a crystal-clear stream winding through ferns and wildflowers, floating pollen particles catching the light, ethereal and serene atmosphere',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000002-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'scene',
   'Rainy City Rooftop',
   'A rain-swept rooftop at dusk overlooking a sprawling city skyline, puddles reflecting the amber streetlights below, antenna arrays and satellite dishes silhouetted against a bruised purple-orange sky, distant thunder, wet concrete surfaces, cinematic moody lighting with volumetric rain',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Framings ─────────────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, created_at, updated_at)
VALUES
  ('e0000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'framing',
   'Cinematic Wide',
   'Ultra-wide cinematic shot, anamorphic lens flare, 2.39:1 aspect ratio framing, shallow depth of field with bokeh background, golden hour rim lighting, ARRI Alexa camera quality, film grain texture, color graded with teal and orange palette',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000003-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'framing',
   'Dramatic Low Angle',
   'Low angle hero shot looking upward, dramatic perspective distortion, strong backlight creating silhouette edges, wide-angle lens 24mm, deep shadows and high contrast, imposing and powerful composition, dutch angle tilt 5 degrees',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'framing',
   'Intimate Portrait',
   'Tight close-up portrait shot, 85mm lens equivalent, extremely shallow depth of field f/1.4, soft natural window light from the left, catch-light visible in the eyes, skin texture detail, gentle vignette, warm color temperature, studio-quality portraiture',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ─── Actions ──────────────────────────────────────────────────

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, created_at, updated_at)
VALUES
  ('e0000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'action',
   'Walking Forward in Rain',
   'Walking confidently forward toward the camera through heavy rain, coat flaring slightly in the wind, water splashing underfoot with each step, purposeful stride, looking straight ahead with determination, raindrops frozen in motion',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'action',
   'Drawing a Bow',
   'Drawing a longbow with full extension, right arm pulled back to the cheek, left arm locked straight, eyes narrowed focusing on a distant target, muscles tense, wind catching loose hair and cloak, dynamic tension pose frozen at the peak moment before release',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),

  ('e0000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'action',
   'Leaning Against a Wall',
   'Leaning against a rough brick wall with one shoulder, arms crossed, one foot propped flat against the wall behind, head tilted slightly downward, contemplative relaxed posture, weight shifted to one side, casual but guarded body language',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
