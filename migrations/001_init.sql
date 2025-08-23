-- Initial schema for SocioVertex backend
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  access_token_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS raw_tweets (
  tweet_id TEXT PRIMARY KEY,
  author_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tweet_text TEXT,
  tweet_created_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_post_id TEXT UNIQUE,
  post_text TEXT,
  post_created_at TIMESTAMPTZ,
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_processed_posts_user ON processed_posts(user_id);

-- YouTube channel snapshots (public lookup style)
CREATE TABLE IF NOT EXISTS youtube_channel_snapshots (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  country TEXT,
  view_count BIGINT,
  subscriber_count BIGINT,
  video_count BIGINT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_youtube_channel_snapshots_channel ON youtube_channel_snapshots(channel_id);
