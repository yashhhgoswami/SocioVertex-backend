# SocioVertex Backend

Step-by-step guide to get the backend running locally.

## 1. Install Dependencies

From the `SocioVertex-backend` folder:

```
npm install
```

## 2. Create a PostgreSQL Database

Use any local Postgres (Docker, pgAdmin, etc.)

Example with Docker:
```
docker run --name sociovx-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

Create database:
```
psql -h localhost -U postgres -c "CREATE DATABASE sociovx;"
```
(Enter password you set, e.g. `postgres`.)

## 3. Copy Environment File

```
cp .env.example .env
```
(Windows PowerShell)
```
Copy-Item .env.example .env
```
Fill in real keys.

## 4. Run Migrations

Open psql for the DB and run the SQL:
```
psql -h localhost -U postgres -d sociovx -f migrations/001_init.sql
```

## 5. OAuth Credentials

Create apps on each platform and set callback URLs:
- Google: `http://localhost:3000/auth/google/callback`
- Twitter: `http://localhost:3000/auth/twitter/callback`
- LinkedIn: `http://localhost:3000/auth/linkedin/callback`

Place the client IDs/secrets in `.env`.

## 6. Start the Server

Development (auto-restart):
```
npm run dev
```
Production style:
```
npm start
```

Server will be at: http://localhost:3000

## 7. Test Auth Flow

Visit: `http://localhost:3000/profile` you'll be prompted to login.

## 8. Cron Job / Tweet Pipeline

Every 15 minutes the scheduler will:
1. Find users with linked Twitter.
2. Fetch their last tweets (max 10).
3. Store raw tweets -> `raw_tweets`.
4. ETL moves processed data -> `processed_posts`.

You can manually trigger pipeline by temporarily adding at bottom of `scheduler.js`:
```js
// fetchAllTweetsAndProcess(); // uncomment to run once on startup
```
(Remember to comment it again.)

## 9. Analytics Endpoint

While logged in, GET:
```
http://localhost:3000/api/v1/analytics/<your_user_id>
```
Returns JSON analytics.

## 10. Frontend Integration

The backend enables CORS for `http://localhost:5173` (default Vite). When you add fetch calls on frontend include `credentials: 'include'` to send the session cookie.

Example:
```js
fetch('http://localhost:3000/api/v1/analytics/' + userId, {
  credentials: 'include'
}).then(r => r.json()).then(console.log);
```

## 11. Troubleshooting

- If sessions not persisting: ensure browser not blocking third-party cookies and origin matches CORS setting.
- If DB errors: check `.env` values; try a simple `SELECT NOW();` in psql.
- If OAuth callback mismatch: update provider console redirect URIs.
- Twitter errors 401: confirm you have Elevated access & correct keys.

## 12. Next Steps (Optional)
- Add refresh tokens & token rotation.
- Add rate limiting.
- Add tests (Jest / supertest).
- Add logging (winston / pino).
- Move secrets to secure store.

---
Happy building! 🚀
