-- Seed: Full Body Framing & Composition
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
-- Essential Full-Body Tags
('fb-essential-1', 'framing', 'Full Body Shot', 'full body shot, head to toe visible, entire figure in frame', 10, 1, '2026-03-11T00:00:00Z'),
('fb-essential-2', 'framing', 'Full Body Portrait', 'full-body portrait, standing full height, from head to feet', 11, 1, '2026-03-11T00:00:00Z'),
('fb-essential-3', 'framing', 'Complete Body', 'complete body visible, top of head to bottom of feet', 12, 1, '2026-03-11T00:00:00Z'),
('fb-essential-4', 'framing', 'Uncropped Figure', 'uncropped full figure, no legs cut off', 13, 1, '2026-03-11T00:00:00Z'),

-- Framing & Composition Boosters
('fb-comp-1', 'framing', 'Wide Shot Centered', 'wide shot full body, subject centered vertically', 20, 1, '2026-03-11T00:00:00Z'),
('fb-comp-2', 'framing', 'Vertical Comp', 'vertical composition, ample headroom and footroom', 21, 1, '2026-03-11T00:00:00Z'),
('fb-comp-3', 'framing', 'Medium Full Body', 'medium full-body view, dynamic pose head-to-toe', 22, 1, '2026-03-11T00:00:00Z'),
('fb-comp-4', 'framing', 'Sharp Focus Full', 'entire subject in frame, sharp focus from crown to toes', 23, 1, '2026-03-11T00:00:00Z'),

-- Anti-Crop & Visibility Enhancers
('fb-vis-1', 'framing', 'Detailed Full Body', 'highly detailed full body, no cropping at edges', 30, 1, '2026-03-11T00:00:00Z'),
('fb-vis-2', 'framing', 'Visible Full Height', 'visible full height, legs and feet fully shown', 31, 1, '2026-03-11T00:00:00Z'),
('fb-vis-3', 'framing', 'Unobstructed Body', 'unobstructed body, clear space around figure', 32, 1, '2026-03-11T00:00:00Z'),
('fb-vis-4', 'framing', 'Aspect Ratio Full', 'perfect aspect ratio for full body, 9:16 or 2:3', 33, 1, '2026-03-11T00:00:00Z'),

-- Camera & Angle Specifiers
('fb-cam-1', 'camera', 'Eye-Level Full', 'eye-level camera angle, straight-on full body', 10, 1, '2026-03-11T00:00:00Z'),
('fb-cam-2', 'camera', 'Neutral Distance', 'neutral camera distance, medium-wide lens', 11, 1, '2026-03-11T00:00:00Z'),
('fb-cam-3', 'camera', 'Low Distortion', 'low distortion full-body capture, realistic proportions', 12, 1, '2026-03-11T00:00:00Z'),
('fb-cam-4', 'camera', 'Front-Facing', 'front-facing full figure, even lighting top to bottom', 13, 1, '2026-03-11T00:00:00Z'),

-- Style/Quality Polishers
('fb-sty-1', 'quality', 'Masterpiece Full Body', 'masterpiece full body, ultra-detailed anatomy', 10, 1, '2026-03-11T00:00:00Z'),
('fb-sty-2', 'quality', 'Photorealistic Full', 'photorealistic full figure, 8k resolution, sharp everywhere', 11, 1, '2026-03-11T00:00:00Z'),
('fb-sty-3', 'quality', 'Cinematic Full Body', 'cinematic full-body shot, professional photography', 12, 1, '2026-03-11T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
