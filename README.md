<div align="center">
  <img src="https://raw.githubusercontent.com/yashhhgoswami/SocioVertex-frontend/main/src/assets/logos/SocioVertex.svg" alt="SocioVertex" height="72"/>
  
  <h1>SocioVertex Backend</h1>
  <p><strong>The unified creator intelligence & social analytics API layer</strong></p>
  
  <p>
    <a href="#features">Features</a> ·
    <a href="#quick-start">Quick Start</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#api-endpoints">API</a> ·
    <a href="#development">Development</a> ·
    <a href="#roadmap">Roadmap</a>
  </p>
  
  <p>
    <img alt="Node" src="https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white"/>
    <img alt="Express" src="https://img.shields.io/badge/Express-5-black"/>
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white"/>
    <img alt="License" src="https://img.shields.io/badge/License-MIT-purple"/>
  </p>
</div>

---

## Overview
SocioVertex Backend powers authentication, data ingestion, ETL, and public creator lookup capabilities (early YouTube + Twitter pipeline). It serves both authenticated user dashboards and anonymous creator searches similar to SocialBlade‑style snapshotting.

## Features
* OAuth via Google, Twitter, LinkedIn (Passport.js)
* Session-based auth (Express session) + `/me` endpoint
* Twitter data pipeline (cron every 15 min): ingest raw tweets → ETL → analytics
* YouTube public channel search (name / handle / ID) + snapshot storage
* Derived channel summary: grade, 7 & 30‑day deltas, earnings estimate
* Aggregated analytics endpoint per authenticated user
* Modular architecture (api/, processing/, migrations/)
* Environment-driven configuration with `.env.example`

## Tech Stack
| Layer | Stack |
|-------|-------|
| Runtime | Node.js / Express 5 |
| Auth | Passport (Google, Twitter, LinkedIn) |
| DB | PostgreSQL (pg Pool) |
| Scheduling | node-cron |
| Twitter API | twitter-api-v2 |
| YouTube API | googleapis (Data API v3) |

## Folder Structure
```
SocioVertex-backend/
  index.js               # App entrypoint & routes wiring
  db.js                  # PG pool & user/identity helpers
  auth-routes.js         # OAuth route definitions
  passport-setup.js      # Passport strategies & serialization
  scheduler.js           # Cron job for Twitter pipeline
  api/
    twitter.js           # Twitter fetch helper (per user)
    youtube.js           # YouTube search + stats + summary
  processing/
    twitter_etl.js       # Raw → processed_posts ETL
  migrations/
    001_init.sql         # Schema (users, identities, tweets, posts, youtube snapshots)
  migrate.js             # Simple migration runner
  README.md
  .env.example
```

## Data Model (Core Tables)
* `users` – internal user profile (display_name, avatar)
* `identities` – OAuth identities (provider, tokens)
* `raw_tweets` – unprocessed user tweets (JSONB)
* `processed_posts` – normalized metrics (likes/retweets/etc.)
* `youtube_channel_snapshots` – point-in-time public channel stats

## API Endpoints
```
GET /health                                   # Health probe
GET /me                                       # Session info (logged in or null)

# Auth (redirect flows)
GET /auth/google
GET /auth/twitter
GET /auth/linkedin
GET /auth/logout

# Authenticated Analytics
GET /api/v1/analytics/:userId                 # Guarded by session + ID match
GET /api/v1/analytics/self                    # Convenience self endpoint

# Public YouTube Stats
GET /public/youtube/search?q=<query>          # Search by name / @handle / ID
GET /public/youtube/channel/:id               # Fetch + persist snapshot
GET /public/youtube/channel/:id/latest        # Latest cached snapshot
GET /public/youtube/channel/:id/history       # Historical snapshots (limit=30)
GET /public/youtube/channel/:id/summary       # Deltas + grade + earnings est.
```

### Example Response (Summary)
```json
{
  "latest": {
    "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "title": "Google Developers",
    "subscriber_count": 2650000,
    "view_count": 250000000,
    "video_count": 4200,
    "fetched_at": "2025-08-23T10:10:10.000Z"
  },
  "subs7": 12000,
  "subs30": 54000,
  "views30": 1800000,
  "estimatedMonthlyEarnings": { "low": 900, "high": 7200 },
  "grade": "A-"
}
```

## Environment Variables
Copy `.env.example` → `.env` then fill:

| Key | Description |
|-----|-------------|
| SESSION_SECRET | Session signing secret |
| PORT | Server port (default 3000) |
| DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_DATABASE | PostgreSQL connection |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Google OAuth 2.0 |
| TWITTER_CONSUMER_KEY / TWITTER_CONSUMER_SECRET | Twitter user auth keys |
| LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET | LinkedIn OAuth |
| YOUTUBE_API_KEY | YouTube Data API v3 key |

## Quick Start
```bash
# 1. Install deps
npm install

# 2. Create database (example)
createdb sociovx   # or psql -c "CREATE DATABASE sociovx;"

# 3. Configure environment
cp .env.example .env  # (Windows: Copy-Item .env.example .env)
edit .env             # add real keys

# 4. Run migration(s)
npm run migrate

# 5. Launch (dev)
npm run dev
```
Visit: http://localhost:3000/health

## Twitter Data Flow
```
cron (15m) → fetch user tweets (api/twitter.js)
          → store raw_tweets
          → ETL (processing/twitter_etl.js) → processed_posts
          → analytics endpoints aggregate processed_posts
```

## YouTube Public Flow
```
User query → /public/youtube/search → searchChannel() → fetchChannelStats()
          → save snapshot → optional /summary for deltas & grade
```

## Development
| Task | Command |
|------|---------|
| Run dev server | `npm run dev` |
| Run production | `npm start` |
| Apply migrations | `npm run migrate` |

### Coding Guidelines
* Keep new provider integrations inside `api/<provider>.js`
* Always wrap multi-statement DB writes in a transaction
* Avoid leaking provider tokens in logs
* Add indices for any new high-cardinality query columns

## Security Notes
* Do NOT commit `.env`
* Use HTTPS & secure cookies in production (`cookie: { secure: true }`)
* Rotate OAuth secrets periodically
* Plan to move sessions to persistent store (Redis / pg) for scaling

## Roadmap
- [ ] Persist daily scheduled YouTube snapshots automatically
- [ ] Compare / rank channels globally (leaderboards)
- [ ] Add Instagram & LinkedIn public metrics modules
- [ ] Add Jest test suite & CI pipeline
- [ ] Rate limiting & abuse protection
- [ ] API key system for third-party consumption
- [ ] Exportable PDF / CSV reports

## Contributing
PRs + issues welcome. Please open an issue describing change before large contributions.

## License
MIT © 2025 SocioVertex

---
**Build. Measure. Grow.** 🚀
