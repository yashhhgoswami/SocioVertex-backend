-- Add bio, about, cover image to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;