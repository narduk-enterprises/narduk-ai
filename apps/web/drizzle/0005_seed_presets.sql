-- Ensure mock user exists (required for FK constraint)
INSERT OR IGNORE INTO users (id, email, password_hash, is_admin, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000003', 'seed@example.com', 'seeded_pass', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO prompt_elements (id, user_id, type, name, content, metadata, created_at, updated_at)
VALUES
  ('5459f280-57b4-49ac-ab41-758a8082a6a2', '00000000-0000-0000-0000-000000000003', 'person', 'Brawny Blacksmith', 'Name: Brawny Blacksmith
Description: Sturdy Craftsman
Age: 45
Gender: Male
Ethnicity: Caucasian
Body type: Muscular and broad
Height: 6 foot 2
Skin tone: Tanned
Hair color: Black
Hair style: Messy short
Eye color: Brown
Face shape: Square
Expression: Focused
Breasts: None
Clothing: Leather apron, linen shirt
Accessories: Gloves
Makeup: None
Tattoos piercings: Tribal arm tattoo
Vibe: Intimidating but protective
Distinguishing features: Soot on face', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('9ff8e95e-d783-4260-9147-d58032223b0e', '00000000-0000-0000-0000-000000000003', 'person', 'Cyberpunk Hacker', 'Name: Cyberpunk Hacker
Description: Neon Netrunner
Age: 23
Gender: Non-binary
Ethnicity: Asian
Body type: Slender
Height: 5 foot 7
Skin tone: Pale
Hair color: Neon pink
Hair style: Undercut
Eye color: Cybernetic blue
Face shape: Heart
Expression: Smirking
Breasts: Small
Clothing: Techwear jacket
Accessories: AR Goggles
Makeup: Glowing eyeliner
Tattoos piercings: Facial cybernetics
Vibe: Rebellious
Distinguishing features: Glowing wires', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('00b26fad-64e4-48d3-90f4-101a16fa500d', '00000000-0000-0000-0000-000000000003', 'person', 'Elder Mage', 'Name: Elder Mage
Description: Wise Sorcerer
Age: 80
Gender: Male
Ethnicity: Middle Eastern
Body type: Frail
Height: 5 foot 10
Skin tone: Olive
Hair color: White
Hair style: Long beard
Eye color: Amber
Face shape: Oval
Expression: Serene
Breasts: None
Clothing: Flowing robes
Accessories: Crystal staff
Makeup: None
Tattoos piercings: Arcane runes on forehead
Vibe: Mystical
Distinguishing features: Glowing eyes', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('fcc5c353-e243-427b-8e49-86c8579de13d', '00000000-0000-0000-0000-000000000003', 'person', 'Space Marine', 'Name: Space Marine
Description: Battle Hardened Leader
Age: 35
Gender: Female
Ethnicity: African
Body type: Athletic
Height: 5 foot 11
Skin tone: Dark
Hair color: Black
Hair style: Buzz cut
Eye color: Dark Brown
Face shape: Round
Expression: Stern
Breasts: Moderate
Clothing: Power armor
Accessories: Dog tags
Makeup: War paint
Tattoos piercings: Scar across eye
Vibe: Commanding
Distinguishing features: Scarred cheek', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('2043d358-580e-4cb1-b06c-8d74680c426f', '00000000-0000-0000-0000-000000000003', 'person', 'Regal Monarch', 'Name: Regal Monarch
Description: Elegant Queen
Age: 50
Gender: Female
Ethnicity: Caucasian
Body type: Hourglass
Height: 5 foot 8
Skin tone: Fair
Hair color: Silver
Hair style: Updo
Eye color: Gray
Face shape: Diamond
Expression: Haughty
Breasts: Large
Clothing: Velvety ballgown
Accessories: Diamond crown
Makeup: Heavy traditional
Tattoos piercings: None
Vibe: Majestic
Distinguishing features: Sharp cheekbones', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('bdf16102-552e-4d28-ba04-06a802b68ea9', '00000000-0000-0000-0000-000000000003', 'person', 'Steampunk Inventor', 'Name: Steampunk Inventor
Description: Quirky Genius
Age: 30
Gender: Male
Ethnicity: Caucasian
Body type: Lean
Height: 5 foot 9
Skin tone: Pale
Hair color: Auburn
Hair style: Wild curls
Eye color: Green
Face shape: Oval
Expression: Curious
Breasts: None
Clothing: Victorian waistcoat
Accessories: Pocket watch, brass goggles
Makeup: None
Tattoos piercings: Gear tattoo on hand
Vibe: Eccentric
Distinguishing features: Ink stains on fingers', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('bb9a3b5e-7493-4d4d-82f6-ab422200e877', '00000000-0000-0000-0000-000000000003', 'person', 'Forest Elf', 'Name: Forest Elf
Description: Agile Ranger
Age: 120
Gender: Female
Ethnicity: Caucasian
Body type: Slender
Height: 6 foot 0
Skin tone: Fair
Hair color: Greenish-blonde
Hair style: Braided
Eye color: Emerald
Face shape: Pointed
Expression: Alert
Breasts: Small
Clothing: Leaf-patterned leather armor
Accessories: Wooden bow
Makeup: Earthy tones
Tattoos piercings: Vinework tattoo
Vibe: Wild but elegant
Distinguishing features: Pointed ears', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('d9d9c3b2-d5b0-48d8-bba6-392028c36c85', '00000000-0000-0000-0000-000000000003', 'scene', 'Cyberpunk Back-Alley', 'Name: Cyberpunk Back-Alley
Description: Neon Dystopia
Setting: Megacity slums
Time of day: Midnight
Weather: Acid rain
Season: Winter
Lighting: Flickering neon, stark shadows
Color palette: Magenta, cyan, deep black
Architecture: Tall brutalist, exposed pipes
Vegetation: None
Props: Holographic ads, trash cans
Atmosphere: Gritty and dangerous
Depth: Narrow corridor
Ground surface: Wet asphalt', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('7406ba1e-fcb4-4f47-834a-72da1bb0f4b0', '00000000-0000-0000-0000-000000000003', 'scene', 'Ancient Desert Library', 'Name: Ancient Desert Library
Description: Sand-Covered Knowledge
Setting: Abandoned ruins
Time of day: Late afternoon
Weather: Clear
Season: Summer
Lighting: Golden hour shafts of light
Color palette: Gold, ochre, dusty brown
Architecture: Sandstone pillars, high arches
Vegetation: Dried desert shrubs
Props: Crumbling scrolls, broken statues
Atmosphere: Mysterious and quiet
Depth: Vast cavernous halls
Ground surface: Sand drifts over stone', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('adccad08-5624-44c5-b8c9-9349dc732d67', '00000000-0000-0000-0000-000000000003', 'scene', 'Space Station Observatory', 'Name: Space Station Observatory
Description: Orbiting Vantage Point
Setting: Space station interior
Time of day: Artificial day/night cycle
Weather: None
Season: None
Lighting: Soft blue ambient, starlight
Color palette: Silver, deep blue, stark white
Architecture: Sleek curves, massive glass windows
Vegetation: Hydroponic plants in corners
Props: Telescopes, control panels
Atmosphere: Peaceful and awe-inspiring
Depth: Infinite backdrop of space
Ground surface: Polished metal', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('ee708ea2-4d10-4477-9ba2-18a82208164f', '00000000-0000-0000-0000-000000000003', 'scene', 'Medieval Tavern', 'Name: Medieval Tavern
Description: Warm Gathering Place
Setting: Village inn
Time of day: Evening
Weather: Snowing outside
Season: Winter
Lighting: Roaring hearth fire, candles
Color palette: Warm oranges, browns
Architecture: Heavy wooden beams, stone walls
Vegetation: Dried herbs hanging from ceiling
Props: Tankards, oak tables
Atmosphere: Cozy and boisterous
Depth: Intimate and enclosed
Ground surface: Wooden floorboards', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('01e95633-4da2-44eb-bcb8-bfc7e1ea56ef', '00000000-0000-0000-0000-000000000003', 'scene', 'Mystic Crystal Cave', 'Name: Mystic Crystal Cave
Description: Glowing Mineral Cavern
Setting: Deep underground
Time of day: Any
Weather: None
Season: None
Lighting: Bioluminescent glow from crystals
Color palette: Purple, cyan, emerald
Architecture: Natural jagged rock formations
Vegetation: Glowing moss
Props: Giant geodes, underground pools
Atmosphere: Magical and serene
Depth: Vast branching tunnels
Ground surface: Uneven stone', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('4a62f4fb-c976-475b-b449-3b8376e0bd82', '00000000-0000-0000-0000-000000000003', 'scene', 'Post-Apocalyptic Highway', 'Name: Post-Apocalyptic Highway
Description: Ruined Overpass
Setting: Abandoned interstate
Time of day: High noon
Weather: Sweltering heat
Season: Summer
Lighting: Harsh direct sunlight
Color palette: Desaturated dusty tones
Architecture: Crumbling concrete bridges
Vegetation: Overgrown weeds piercing asphalt
Props: Rusted cars, debris
Atmosphere: Desolate and lonely
Depth: Long endless road fading into haze
Ground surface: Cracked tarmac', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('43f1a10a-4d9d-4cbc-b31b-a5d530ec618d', '00000000-0000-0000-0000-000000000003', 'scene', 'Enchanted Faerie Ring', 'Name: Enchanted Faerie Ring
Description: Magical Forest Clearing
Setting: Deep woods
Time of day: Twilight
Weather: Mist
Season: Spring
Lighting: Glowing fireflies, moonlight
Color palette: Deep greens, silvery blues
Architecture: Natural arches of ancient trees
Vegetation: Giant mushrooms, lush ferns
Props: Floating motes of light
Atmosphere: Ethereal and mystical
Depth: Circular clearing surrounded by dense trees
Ground surface: Soft moss and grass', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('f5ae2ba2-e2e2-4038-98d5-65c0a943e8ec', '00000000-0000-0000-0000-000000000003', 'framing', 'Intimate Close-Up', 'Name: Intimate Close-Up
Description: Emotional Empathy
Shot type: extreme close-up
Camera angle: eye level
Camera height: eye level
Lens: macro
Focal length: 100mm
Depth of field: very shallow
Focus point: eyes
Camera movement: static
Composition rule: golden ratio
Aspect ratio: 4:5', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('df64d5d6-5dbd-4e81-8be5-31438db4258f', '00000000-0000-0000-0000-000000000003', 'framing', 'Dutch Angle Thriller', 'Name: Dutch Angle Thriller
Description: Unsettling Tension
Shot type: medium shot
Camera angle: dutch angle
Camera height: chest level
Lens: standard
Focal length: 35mm
Depth of field: moderate
Focus point: subject face
Camera movement: slight handheld shake
Composition rule: diagonal lines
Aspect ratio: 16:9', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('6ece6f56-c4a6-4e19-88ae-20f8f8bcad28', '00000000-0000-0000-0000-000000000003', 'framing', 'Birds Eye Top Down', 'Name: Birds Eye Top Down
Description: Gods View
Shot type: extreme wide shot
Camera angle: top down
Camera height: high above
Lens: wide
Focal length: 24mm
Depth of field: infinite
Focus point: entire scene
Camera movement: slow zoom out
Composition rule: symmetry
Aspect ratio: 1:1', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('fae56692-8ebb-4b8a-99c7-29619b014308', '00000000-0000-0000-0000-000000000003', 'framing', 'Over the Shoulder Guard', 'Name: Over the Shoulder Guard
Description: Conversational Depth
Shot type: over the shoulder
Camera angle: eye level
Camera height: shoulder level
Lens: telephoto
Focal length: 85mm
Depth of field: shallow
Focus point: secondary subject
Camera movement: static
Composition rule: rule of thirds
Aspect ratio: 2.35:1', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('b2dd1fca-a351-488a-a1b9-14e899cb2706', '00000000-0000-0000-0000-000000000003', 'framing', 'Low Angle Dominance', 'Name: Low Angle Dominance
Description: Heroic Power
Shot type: full shot
Camera angle: low angle
Camera height: knee level
Lens: ultra-wide
Focal length: 14mm
Depth of field: deep
Focus point: subject chest
Camera movement: slow upward pan
Composition rule: central framing
Aspect ratio: 9:16', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('e54ec766-683b-4407-9fe2-04318ea4695e', '00000000-0000-0000-0000-000000000003', 'framing', 'Tracking Profile Shot', 'Name: Tracking Profile Shot
Description: Dynamic Movement
Shot type: medium full shot
Camera angle: profile
Camera height: waist level
Lens: standard
Focal length: 50mm
Depth of field: shallow
Focus point: moving subject
Camera movement: tracking
Composition rule: lead room
Aspect ratio: 16:9', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('1e5147f5-68d8-4e0b-a021-f543923abf55', '00000000-0000-0000-0000-000000000003', 'framing', 'High Angle Vulnerability', 'Name: High Angle Vulnerability
Description: Small and Weak
Shot type: wide shot
Camera angle: high angle
Camera height: overhead scaffolding
Lens: standard
Focal length: 35mm
Depth of field: deep
Focus point: subject looking up
Camera movement: static
Composition rule: negative space
Aspect ratio: 4:3', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('b2b391a0-a708-41bd-95a4-e554f98bdf5f', '00000000-0000-0000-0000-000000000003', 'action', 'Meditative Levitation', 'Name: Meditative Levitation
Description: Zen Floating
Primary action: levitating in lotus pose
Body position: crossed legs, floating
Hand placement: resting on knees, palms up
Head direction: looking straight ahead with closed eyes
Facial expression: peaceful calm
Motion blur: none
Energy level: low and tranquil
Interaction: floating above the ground
Emotion: serene', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('83b7d324-5ede-4cf6-90d3-fef6a9434329', '00000000-0000-0000-0000-000000000003', 'action', 'Fleeing in Panic', 'Name: Fleeing in Panic
Description: Desperate Running
Primary action: running away
Body position: leaning forward, mid-stride
Hand placement: arms pumping wildly
Head direction: looking back over shoulder
Facial expression: sheer terror
Motion blur: heavy on limbs and background
Energy level: extreme high
Interaction: running across terrain
Emotion: fearful', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('cd7cb595-e946-4408-b5ec-bb20d800b008', '00000000-0000-0000-0000-000000000003', 'action', 'Casting a Spell', 'Name: Casting a Spell
Description: Magical Invocation
Primary action: casting magic
Body position: wide powerful stance
Hand placement: one hand raised with fingers splayed
Head direction: looking at target
Facial expression: intense focus
Motion blur: swirling magical energy
Energy level: high burst
Interaction: releasing blast of energy
Emotion: determined', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('c9907e1b-4982-416a-bdee-ce6c71ca4328', '00000000-0000-0000-0000-000000000003', 'action', 'Tender Embrace', 'Name: Tender Embrace
Description: Loving Hug
Primary action: hugging another person
Body position: close contact, leaning in
Hand placement: wrapped around partners back
Head direction: resting on shoulder
Facial expression: soft smile, eyes closed
Motion blur: none
Energy level: calm
Interaction: holding partner gently
Emotion: affectionate', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('4709419c-4e42-47a8-90b2-11437033d861', '00000000-0000-0000-0000-000000000003', 'action', 'Sneaking in Shadows', 'Name: Sneaking in Shadows
Description: Stealthy Movement
Primary action: tip-toeing
Body position: crouched low
Hand placement: hugging a wall
Head direction: peering around corner
Facial expression: tense and concentrated
Motion blur: very slight
Energy level: tense and contained
Interaction: moving silently against a wall
Emotion: anxious but focused', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('dd737058-af26-4b33-a74e-a9b2f2dbc8ea', '00000000-0000-0000-0000-000000000003', 'action', 'Triumphant Cheer', 'Name: Triumphant Cheer
Description: Joyous Victory
Primary action: cheering and shouting
Body position: standing tall, chest out
Hand placement: both fists raised in air
Head direction: thrown back, looking up
Facial expression: roaring shout of joy
Motion blur: subtle shake
Energy level: ecstatic
Interaction: none
Emotion: victorious', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('36a0bd12-1d2a-40c1-a6ed-1ee88f710ecf', '00000000-0000-0000-0000-000000000003', 'action', 'Reading an Ancient Tome', 'Name: Reading an Ancient Tome
Description: Scholarly Discovery
Primary action: reading a book
Body position: seated, hunched over
Hand placement: turning a delicate page
Head direction: staring down at book
Facial expression: wide-eyed awe
Motion blur: none
Energy level: quiet intensity
Interaction: handling a dusty leather book
Emotion: astonished', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('e4137daf-a8ac-4337-9cc3-626d11cf3ff2', '00000000-0000-0000-0000-000000000003', 'style', 'Cyberpunk Noir', 'Name: Cyberpunk Noir
Description: Gritty Neon Futurism
Art medium: Digital Concept Art
Color palette: Neon cyan, magenta, deep black, sickly green
Lighting: High contrast, harsh neon reflections, deep shadows
Brushwork or texture: Smooth gradients mixed with digital noise
Influence or era: 1980s retro-futurism, Blade Runner
Mood: Cynical, atmospheric, dangerous
Level of detail: Hyper-detailed technical elements
Key elements: Holograms, rain slicked surfaces, cybernetics', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('c43c19c0-8af7-44af-b7b7-bd1f17cbf1ba', '00000000-0000-0000-0000-000000000003', 'style', 'Watercolor Dream', 'Name: Watercolor Dream
Description: Soft Ethereal Washes
Art medium: Traditional Watercolor
Color palette: Pastel pinks, soft blues, washed out yellows
Lighting: Soft, diffused ambient light
Brushwork or texture: Bleeding colors, paper texture, fluid washes
Influence or era: Studio Ghibli backgrounds, impressionism
Mood: Gentle, nostalgic, peaceful
Level of detail: Loose and impressionistic
Key elements: Color blooms, soft edges, visible paper grain', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('d53bf65f-a35b-4a50-85d6-5949cfb971dd', '00000000-0000-0000-0000-000000000003', 'style', 'Vintage Oil Painting', 'Name: Vintage Oil Painting
Description: Classic Renaissance Portraiture
Art medium: Oil on Canvas
Color palette: Earth tones, rich warm browns, deep burgundies
Lighting: Chiaroscuro, dramatic directional lighting
Brushwork or texture: Thick impasto texture, visible brush strokes
Influence or era: Rembrandt, 17th Century Dutch Golden Age
Mood: Somber, dignified, dramatic
Level of detail: High realism with soft edges
Key elements: Cracked varnish texture, dark backgrounds', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('cd9034c0-6681-4b29-9dc0-974b153e8b67', '00000000-0000-0000-0000-000000000003', 'style', 'Ukiyo-e Woodblock', 'Name: Ukiyo-e Woodblock
Description: Classic Japanese Prints
Art medium: Woodblock Print
Color palette: Indigo, vermilion, muted earth greens
Lighting: Flat, graphic lighting with no deep shadows
Brushwork or texture: Clean linework, textured ink impressions
Influence or era: Edo Period Japan, Hokusai
Mood: Contemplative, historical, stylized
Level of detail: Graphic and simplified with intricate patterning
Key elements: Washi paper texture, flat colors, bold outlines', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('fb7c0e85-0acf-4b86-b512-7a758ded3086', '00000000-0000-0000-0000-000000000003', 'style', 'Cinematic Photorealism', 'Name: Cinematic Photorealism
Description: High-End Film Production
Art medium: 35mm Film Photography
Color palette: Color-graded teal and orange
Lighting: 3-point studio lighting, rim lights, lens flares
Brushwork or texture: Film grain, optical imperfection
Influence or era: Modern Hollywood blockbusters
Mood: Epic, dramatic, immersive
Level of detail: Ultra-realistic 8k resolution
Key elements: Bokeh, anamorphic flares, cinematic grading', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('e4815b9a-f2f6-4b32-8e3a-8cbbceb402ca', '00000000-0000-0000-0000-000000000003', 'style', 'Dark Fantasy Illustration', 'Name: Dark Fantasy Illustration
Description: Grimdark Epic Art
Art medium: Digital Painting
Color palette: Desaturated grays, blood red accents, muted golds
Lighting: Gloomy, overcast, dramatic magical rim lighting
Brushwork or texture: Painterly strokes, grim grit
Influence or era: Dark Souls, Frank Frazetta
Mood: Oppressive, epic, foreboding
Level of detail: Highly detailed armor and monsters
Key elements: Skulls, spiked armor, ruined castles', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('6b00d76b-79db-4401-93ba-c3346d16bacc', '00000000-0000-0000-0000-000000000003', 'style', 'Retro Anime', 'Name: Retro Anime
Description: 90s Cel Animation
Art medium: Hand-drawn Cel Animation
Color palette: Bright saturated colors, slightly washed out vintage feel
Lighting: Flat anime shading, sharp highlights
Brushwork or texture: Acetate cel texture, slight VHS noise
Influence or era: 1990s Japanese animation
Mood: Energetic, nostalgic
Level of detail: Simplified line art, detailed painted backgrounds
Key elements: Speed lines, expressive sweat drops, vivid skies', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('6fc32190-2000-4834-94ba-df9984848fb6', '00000000-0000-0000-0000-000000000003', 'style', 'Minimalist Vector', 'Name: Minimalist Vector
Description: Clean Graphic Design
Art medium: Vector Illustration
Color palette: Limited palette of 3-4 bold flat colors
Lighting: None, implied through color blocking
Brushwork or texture: Perfectly smooth, mathematical curves
Influence or era: Modern corporate aesthetics, Bauhaus
Mood: Clean, professional, modern
Level of detail: Extremely low detail, focus on silhouette
Key elements: Flawless geometry, negative space, no outlines', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('3f9031ee-b153-4ef9-b59c-33d1c39eca00', '00000000-0000-0000-0000-000000000003', 'style', 'Pencil Sketch', 'Name: Pencil Sketch
Description: Rough Graphite Drawing
Art medium: Graphite on Paper
Color palette: Monochrome black and white, subtle smudged grays
Lighting: Shaded with hatching and cross-hatching
Brushwork or texture: Rough paper grain, loose sketchy lines
Influence or era: Renaissance sketchbooks, Da Vinci
Mood: Raw, intimate, in-progress
Level of detail: Suggestive rather than rendered
Key elements: Construction lines visible, graphite smudges', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('e1ad5a27-52dc-49dd-92d9-d2b68a411fc1', '00000000-0000-0000-0000-000000000003', 'style', 'Synthwave Aesthethic', 'Name: Synthwave Aesthetic
Description: 80s Retrowave Grid
Art medium: 3D Render
Color palette: Hot pink, laser grid cyan, deep purple space
Lighting: Glowing neon vectors against dark background
Brushwork or texture: Low-poly early CGI look mixed with bloom
Influence or era: 1980s arcade graphics, Outrun
Mood: Nostalgic, electronic, fast-paced
Level of detail: Geometric simplicity
Key elements: Wireframe mountains, glowing sun, chrome text', null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
