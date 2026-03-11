CREATE TABLE `quick_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`snippet` text NOT NULL,
	`sort_order` integer NOT NULL DEFAULT 0,
	`enabled` integer NOT NULL DEFAULT 1,
	`updated_at` text NOT NULL
);

-- Seed: Lighting
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
('golden-hour', 'lighting', 'Golden Hour', 'golden hour warm sunlight, long shadows', 0, 1, '2026-03-11T00:00:00Z'),
('neon-lit', 'lighting', 'Neon Lit', 'neon-lit, colorful neon reflections', 1, 1, '2026-03-11T00:00:00Z'),
('studio-softbox', 'lighting', 'Studio Softbox', 'studio softbox lighting, even diffused light', 2, 1, '2026-03-11T00:00:00Z'),
('harsh-midday', 'lighting', 'Harsh Midday', 'harsh midday sun, strong shadows, high contrast', 3, 1, '2026-03-11T00:00:00Z'),
('candlelight', 'lighting', 'Candlelight', 'warm candlelight, flickering shadows, intimate atmosphere', 4, 1, '2026-03-11T00:00:00Z'),
('backlit', 'lighting', 'Backlit', 'dramatic backlighting, rim light, silhouette edges', 5, 1, '2026-03-11T00:00:00Z');

-- Seed: Mood
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
('cinematic', 'mood', 'Cinematic', 'cinematic look, movie-quality color grading', 0, 1, '2026-03-11T00:00:00Z'),
('dreamy', 'mood', 'Dreamy', 'dreamy soft focus, ethereal glow, pastel haze', 1, 1, '2026-03-11T00:00:00Z'),
('gritty', 'mood', 'Gritty', 'gritty raw aesthetic, desaturated, urban decay', 2, 1, '2026-03-11T00:00:00Z'),
('ethereal', 'mood', 'Ethereal', 'ethereal atmosphere, otherworldly luminescence', 3, 1, '2026-03-11T00:00:00Z'),
('melancholic', 'mood', 'Melancholic', 'melancholic mood, muted tones, overcast sky', 4, 1, '2026-03-11T00:00:00Z');

-- Seed: Camera
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
('shallow-dof', 'camera', 'Shallow DOF', 'shallow depth of field, f/1.4, creamy bokeh', 0, 1, '2026-03-11T00:00:00Z'),
('35mm-film', 'camera', '35mm Film', 'shot on 35mm film, natural film grain, analog feel', 1, 1, '2026-03-11T00:00:00Z'),
('drone-aerial', 'camera', 'Drone Aerial', 'drone aerial shot, bird''s eye view, sweeping vista', 2, 1, '2026-03-11T00:00:00Z'),
('macro-closeup', 'camera', 'Macro Close-up', 'macro close-up, extreme detail, razor-thin focus plane', 3, 1, '2026-03-11T00:00:00Z'),
('wide-angle', 'camera', 'Wide Angle', 'wide angle lens, expansive composition, dramatic perspective', 4, 1, '2026-03-11T00:00:00Z');

-- Seed: Detail
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
('ultra-detail', 'detail', 'Ultra Detail', 'ultra-detailed, skin pores visible, hyper-sharp textures', 0, 1, '2026-03-11T00:00:00Z'),
('volumetric-fog', 'detail', 'Volumetric Fog', 'volumetric fog, atmospheric haze, god rays', 1, 1, '2026-03-11T00:00:00Z'),
('lens-flare', 'detail', 'Lens Flare', 'natural lens flare, anamorphic streaks', 2, 1, '2026-03-11T00:00:00Z'),
('wet-surfaces', 'detail', 'Wet Surfaces', 'wet reflective surfaces, rain-slicked, water droplets', 3, 1, '2026-03-11T00:00:00Z');

-- Seed: Quality
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
('photorealistic', 'quality', 'Photorealistic', 'photorealistic, indistinguishable from a real photograph', 0, 1, '2026-03-11T00:00:00Z'),
('sony-a7iv', 'quality', 'Sony A7IV', 'shot on Sony A7IV, natural color science', 1, 1, '2026-03-11T00:00:00Z'),
('raw-photo', 'quality', 'RAW Photo', 'RAW photograph, unprocessed natural detail', 2, 1, '2026-03-11T00:00:00Z'),
('award-winning', 'quality', 'Award Winning', 'award-winning photography, masterful composition', 3, 1, '2026-03-11T00:00:00Z'),
('8k-resolution', 'quality', '8K Resolution', '8K resolution, extreme clarity, sharp throughout', 4, 1, '2026-03-11T00:00:00Z');
