-- Seed: Person Attributes Modifiers
INSERT INTO `quick_modifiers` (`id`, `category`, `label`, `snippet`, `sort_order`, `enabled`, `updated_at`) VALUES
-- Age
('age-child', 'age', 'Child', 'young child, 8 years old, juvenile', 1, 1, '2026-03-11T00:00:00Z'),
('age-teen', 'age', 'Teen', 'teenager, 16 years old, youthful adolescence', 2, 1, '2026-03-11T00:00:00Z'),
('age-20s', 'age', '20s', '20s, young adult, 25 years old', 3, 1, '2026-03-11T00:00:00Z'),
('age-30s', 'age', '30s', '30s, adult, 35 years old', 4, 1, '2026-03-11T00:00:00Z'),
('age-40s', 'age', '40s', '40s, mature adult, 45 years old', 5, 1, '2026-03-11T00:00:00Z'),
('age-50s', 'age', '50s', '50s, middle-aged, 55 years old', 6, 1, '2026-03-11T00:00:00Z'),
('age-senior', 'age', 'Senior', 'senior citizen, 70s, elderly, white hair, wrinkles', 7, 1, '2026-03-11T00:00:00Z'),

-- Gender
('gender-male', 'gender', 'Male', 'male, man', 1, 1, '2026-03-11T00:00:00Z'),
('gender-female', 'gender', 'Female', 'female, woman', 2, 1, '2026-03-11T00:00:00Z'),
('gender-androgynous', 'gender', 'Androgynous', 'androgynous, gender-neutral, non-binary', 3, 1, '2026-03-11T00:00:00Z'),
('gender-trans', 'gender', 'Transgender', 'transgender, transgender person', 4, 1, '2026-03-11T00:00:00Z'),

-- Ethnicity
('eth-caucasian', 'ethnicity', 'Caucasian', 'caucasian, white European descent', 1, 1, '2026-03-11T00:00:00Z'),
('eth-asian', 'ethnicity', 'Asian', 'asian descent, East Asian features', 2, 1, '2026-03-11T00:00:00Z'),
('eth-african', 'ethnicity', 'African', 'african descent, Black African features', 3, 1, '2026-03-11T00:00:00Z'),
('eth-hispanic', 'ethnicity', 'Hispanic', 'hispanic, Latino descent', 4, 1, '2026-03-11T00:00:00Z'),
('eth-middle-eastern', 'ethnicity', 'Middle Eastern', 'middle eastern descent, Arab features', 5, 1, '2026-03-11T00:00:00Z'),
('eth-south-asian', 'ethnicity', 'South Asian', 'south asian, Indian descent', 6, 1, '2026-03-11T00:00:00Z'),

-- Body type
('body-slender', 'body type', 'Slender', 'slender, skinny, very thin body', 1, 1, '2026-03-11T00:00:00Z'),
('body-fit', 'body type', 'Fit', 'fit, toned, athletic body, gym body', 2, 1, '2026-03-11T00:00:00Z'),
('body-muscular', 'body type', 'Muscular', 'very muscular, bodybuilder, ripped, huge muscles', 3, 1, '2026-03-11T00:00:00Z'),
('body-curvy', 'body type', 'Curvy', 'curvy, wide hips, hourglass figure, thick thighs', 4, 1, '2026-03-11T00:00:00Z'),
('body-chubby', 'body type', 'Chubby', 'chubby, plump, soft body, overweight', 5, 1, '2026-03-11T00:00:00Z'),
('body-average', 'body type', 'Average', 'average body type, normal weight', 6, 1, '2026-03-11T00:00:00Z'),
('body-petite', 'body type', 'Petite', 'petite, small frame, short and delicate', 7, 1, '2026-03-11T00:00:00Z'),

-- Height
('height-short', 'height', 'Short', 'short height, 5 foot 0', 1, 1, '2026-03-11T00:00:00Z'),
('height-average', 'height', 'Average', 'average height, 5 foot 7', 2, 1, '2026-03-11T00:00:00Z'),
('height-tall', 'height', 'Tall', 'tall height, 6 foot 2', 3, 1, '2026-03-11T00:00:00Z'),

-- Skin tone
('skin-pale', 'skin tone', 'Pale', 'very pale skin, porcelain skin', 1, 1, '2026-03-11T00:00:00Z'),
('skin-fair', 'skin tone', 'Fair', 'fair skin, light skin', 2, 1, '2026-03-11T00:00:00Z'),
('skin-tanned', 'skin tone', 'Tanned', 'sun-tanned skin, olive skin tone', 3, 1, '2026-03-11T00:00:00Z'),
('skin-brown', 'skin tone', 'Brown', 'brown skin tone, rich warm brown skin', 4, 1, '2026-03-11T00:00:00Z'),
('skin-dark', 'skin tone', 'Dark', 'dark black skin tone, very deep dark skin', 5, 1, '2026-03-11T00:00:00Z'),

-- Hair color
('hair-color-black', 'hair color', 'Black', 'black hair', 1, 1, '2026-03-11T00:00:00Z'),
('hair-color-brown', 'hair color', 'Brown', 'brown hair, brunette', 2, 1, '2026-03-11T00:00:00Z'),
('hair-color-blonde', 'hair color', 'Blonde', 'blonde hair', 3, 1, '2026-03-11T00:00:00Z'),
('hair-color-red', 'hair color', 'Red', 'red hair, ginger, copper hair', 4, 1, '2026-03-11T00:00:00Z'),
('hair-color-silver', 'hair color', 'Silver', 'silver hair, white hair', 5, 1, '2026-03-11T00:00:00Z'),
('hair-color-pink', 'hair color', 'Pink', 'bright pink dyed hair', 6, 1, '2026-03-11T00:00:00Z'),
('hair-color-blue', 'hair color', 'Blue', 'blue dyed hair', 7, 1, '2026-03-11T00:00:00Z'),

-- Hair style
('hair-style-bald', 'hair style', 'Bald', 'bald head, no hair', 1, 1, '2026-03-11T00:00:00Z'),
('hair-style-short', 'hair style', 'Short', 'short cut hair', 2, 1, '2026-03-11T00:00:00Z'),
('hair-style-shoulder', 'hair style', 'Shoulder-length', 'shoulder-length hair', 3, 1, '2026-03-11T00:00:00Z'),
('hair-style-long', 'hair style', 'Long', 'very long flowing hair', 4, 1, '2026-03-11T00:00:00Z'),
('hair-style-straight', 'hair style', 'Straight', 'straight flat hair', 5, 1, '2026-03-11T00:00:00Z'),
('hair-style-wavy', 'hair style', 'Wavy', 'wavy hair', 6, 1, '2026-03-11T00:00:00Z'),
('hair-style-curly', 'hair style', 'Curly', 'curly hair, tight curls', 7, 1, '2026-03-11T00:00:00Z'),
('hair-style-ponytail', 'hair style', 'Ponytail', 'hair tied back in a ponytail', 8, 1, '2026-03-11T00:00:00Z'),
('hair-style-dreads', 'hair style', 'Dreadlocks', 'dreadlocks, locs', 9, 1, '2026-03-11T00:00:00Z'),
('hair-style-buzz', 'hair style', 'Buzz cut', 'buzz cut, shaved head', 10, 1, '2026-03-11T00:00:00Z'),

-- Eye color
('eye-brown', 'eye color', 'Brown', 'brown eyes', 1, 1, '2026-03-11T00:00:00Z'),
('eye-blue', 'eye color', 'Blue', 'bright blue eyes', 2, 1, '2026-03-11T00:00:00Z'),
('eye-green', 'eye color', 'Green', 'emerald green eyes', 3, 1, '2026-03-11T00:00:00Z'),
('eye-hazel', 'eye color', 'Hazel', 'hazel eyes, light brownish-green eyes', 4, 1, '2026-03-11T00:00:00Z'),
('eye-grey', 'eye color', 'Grey', 'piercing grey eyes', 5, 1, '2026-03-11T00:00:00Z'),

-- Face shape
('face-oval', 'face shape', 'Oval', 'oval face shape', 1, 1, '2026-03-11T00:00:00Z'),
('face-round', 'face shape', 'Round', 'round face shape, soft jaw', 2, 1, '2026-03-11T00:00:00Z'),
('face-square', 'face shape', 'Square', 'square face blocky jawline', 3, 1, '2026-03-11T00:00:00Z'),
('face-heart', 'face shape', 'Heart', 'heart shaped face, pointy chin', 4, 1, '2026-03-11T00:00:00Z'),
('face-long', 'face shape', 'Long', 'long narrow face, high cheekbones', 5, 1, '2026-03-11T00:00:00Z'),

-- Expression
('expr-smiling', 'expression', 'Smiling', 'smiling happily, warm smile', 1, 1, '2026-03-11T00:00:00Z'),
('expr-laughing', 'expression', 'Laughing', 'laughing out loud, big open mouth smile', 2, 1, '2026-03-11T00:00:00Z'),
('expr-serious', 'expression', 'Serious', 'serious expression, deadpan, staring intently', 3, 1, '2026-03-11T00:00:00Z'),
('expr-angry', 'expression', 'Angry', 'angry furious glare, scowling', 4, 1, '2026-03-11T00:00:00Z'),
('expr-sad', 'expression', 'Sad', 'sad expression, crying, tearful', 5, 1, '2026-03-11T00:00:00Z'),
('expr-smirking', 'expression', 'Smirking', 'smirking, arrogant smile', 6, 1, '2026-03-11T00:00:00Z'),
('expr-surprised', 'expression', 'Surprised', 'surprised expression, wide eyes, shocked', 7, 1, '2026-03-11T00:00:00Z'),
('expr-alluring', 'expression', 'Alluring', 'seductive alluring gaze, slightly parted lips', 8, 1, '2026-03-11T00:00:00Z'),

-- Clothing
('cloth-casual', 'clothing', 'Casual', 'casual daily clothes, t-shirt and jeans', 1, 1, '2026-03-11T00:00:00Z'),
('cloth-formal', 'clothing', 'Formal', 'formal suit, elegant evening wear', 2, 1, '2026-03-11T00:00:00Z'),
('cloth-business', 'clothing', 'Business', 'business attire, office wear', 3, 1, '2026-03-11T00:00:00Z'),
('cloth-sports', 'clothing', 'Sports', 'athletic gym clothing, sports bra and leggings, sweatpants', 4, 1, '2026-03-11T00:00:00Z'),
('cloth-swimwear', 'clothing', 'Swimwear', 'bikini, swimsuit, beachwear', 5, 1, '2026-03-11T00:00:00Z'),
('cloth-lingerie', 'clothing', 'Lingerie', 'sexy lingerie, lace underwear', 6, 1, '2026-03-11T00:00:00Z'),
('cloth-winter', 'clothing', 'Winter', 'thick winter coat, scarf, beanie', 7, 1, '2026-03-11T00:00:00Z'),
('cloth-cyberpunk', 'clothing', 'Cyberpunk', 'high-tech cyberpunk clothing, glowing neon accents, leather', 8, 1, '2026-03-11T00:00:00Z'),
('cloth-fantasy', 'clothing', 'Fantasy Armor', 'medieval fantasy armor, plate mail', 9, 1, '2026-03-11T00:00:00Z'),
('cloth-naked', 'clothing', 'Naked', 'completely naked, nude, skin bare', 10, 1, '2026-03-11T00:00:00Z'),

-- Accessories
('acc-none', 'accessories', 'None', 'no accessories', 1, 1, '2026-03-11T00:00:00Z'),
('acc-glasses', 'accessories', 'Glasses', 'wearing thick rimmed glasses', 2, 1, '2026-03-11T00:00:00Z'),
('acc-sunglasses', 'accessories', 'Sunglasses', 'wearing stylish sunglasses', 3, 1, '2026-03-11T00:00:00Z'),
('acc-jewelry', 'accessories', 'Jewelry', 'wearing flashy jewelry, diamond necklace, gold rings', 4, 1, '2026-03-11T00:00:00Z'),
('acc-hat', 'accessories', 'Hat', 'wearing a stylish hat', 5, 1, '2026-03-11T00:00:00Z'),

-- Makeup
('makeup-none', 'makeup', 'No Makeup', 'no makeup, natural face, fresh faced', 1, 1, '2026-03-11T00:00:00Z'),
('makeup-light', 'makeup', 'Light', 'light natural makeup, lip gloss', 2, 1, '2026-03-11T00:00:00Z'),
('makeup-heavy', 'makeup', 'Heavy', 'heavy glamorous makeup, dark eyeliner, dark lipstick', 3, 1, '2026-03-11T00:00:00Z'),
('makeup-goth', 'makeup', 'Goth', 'gothic makeup, black lipstick, heavy eyeshadow', 4, 1, '2026-03-11T00:00:00Z'),

-- Tattoos pierced
('tattoo-none', 'tattoos piercings', 'None', 'clean skin, no tattoos, no piercings', 1, 1, '2026-03-11T00:00:00Z'),
('tattoo-ears', 'tattoos piercings', 'Ear Piercings', 'ear piercings, multiple ear rings', 2, 1, '2026-03-11T00:00:00Z'),
('tattoo-facial', 'tattoos piercings', 'Facial Piercing', 'nose ring, lip ring, facial piercings', 3, 1, '2026-03-11T00:00:00Z'),
('tattoo-small', 'tattoos piercings', 'Small Tattoos', 'small subtle tattoos', 4, 1, '2026-03-11T00:00:00Z'),
('tattoo-sleeves', 'tattoos piercings', 'Tattoo Sleeves', 'full tattoo sleeves, heavily tattooed arms', 5, 1, '2026-03-11T00:00:00Z'),
('tattoo-fullbody', 'tattoos piercings', 'Full Body Tattoos', 'full body tattoos, covered in ink', 6, 1, '2026-03-11T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

