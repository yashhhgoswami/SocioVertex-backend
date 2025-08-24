// index.js (Complete File)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const db = require('./db');
const authRoutes = require('./auth-routes');
const youtubeApi = require('./api/youtube');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('./passport-setup'); 
require('./scheduler');

const app = express();
const port = 3000;

// Basic middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // adjust origin to frontend dev server
app.use(express.json({ limit: '2mb' }));
// Static serving for uploaded images
const uploadDir = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// Multer storage for avatar uploads
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, uploadDir),
  filename: (req,file,cb)=> {
    const ext = path.extname(file.originalname||'');
    cb(null, `avatar_${req.user?.id||'anon'}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);

// Simple auth guard middleware
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Session info for frontend
app.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const userRes = await db.query('SELECT id, display_name, avatar_url, created_at, bio, about, cover_image_url FROM users WHERE id=$1',[req.user.id]);
  res.json({ user: userRes.rows[0] });
});

// Update profile basic fields
app.patch('/api/profile', requireAuth, async (req,res)=>{
  const { display_name, bio, about } = req.body;
  try {
    const userRes = await db.query(`UPDATE users SET 
      display_name = COALESCE($1, display_name),
      bio = COALESCE($2, bio),
      about = COALESCE($3, about)
      WHERE id=$4 RETURNING id, display_name, avatar_url, created_at, bio, about, cover_image_url`,
      [display_name, bio, about, req.user.id]);
    res.json({ user: userRes.rows[0] });
  } catch(e){
    console.error(e); res.status(500).json({ error: 'Update failed' });
  }
});

// Upload avatar
app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req,res)=>{
  try {
    if(!req.file) return res.status(400).json({ error:'No file' });
    const rel = '/uploads/' + path.basename(req.file.path);
    const userRes = await db.query('UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id, display_name, avatar_url, created_at, bio, about, cover_image_url',[rel, req.user.id]);
    res.json({ user: userRes.rows[0] });
  } catch(e){
    console.error(e); res.status(500).json({ error:'Avatar upload failed' });
  }
});

// Update cover image via URL (simple)
app.patch('/api/profile/cover', requireAuth, async (req,res)=>{
  const { cover_image_url } = req.body;
  if(!cover_image_url) return res.status(400).json({ error:'Missing cover_image_url'});
  try {
    const userRes = await db.query('UPDATE users SET cover_image_url=$1 WHERE id=$2 RETURNING id, display_name, avatar_url, created_at, bio, about, cover_image_url',[cover_image_url, req.user.id]);
    res.json({ user: userRes.rows[0] });
  } catch(e){
    console.error(e); res.status(500).json({ error:'Cover update failed'});
  }
});

app.get('/', (req, res) => {
  res.send('Automated Social Media Analytics Tool: Backend is operational.');
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public endpoint to fetch (and store) a fresh YouTube channel snapshot by channel ID
app.get('/public/youtube/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const stats = await youtubeApi.fetchChannelStats(channelId);
    if(!stats) return res.status(404).json({ error: 'Channel not found' });
    await youtubeApi.saveSnapshot(stats); // store snapshot
    res.json({ stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch channel stats' });
  }
});

// Get latest cached snapshot without hitting API (fast)
app.get('/public/youtube/channel/:channelId/latest', async (req, res) => {
  try {
    const data = await youtubeApi.latestSnapshot(req.params.channelId);
    if(!data) return res.status(404).json({ error:'No snapshot' });
    res.json({ stats: data });
  } catch (e) {
    res.status(500).json({ error:'Failed' });
  }
});

// Historical snapshots
app.get('/public/youtube/channel/:channelId/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit||'30',10);
    const rows = await youtubeApi.historicalSnapshots(req.params.channelId, limit);
    res.json({ history: rows });
  } catch (e) {
    res.status(500).json({ error:'Failed' });
  }
});

// Search channel by query (name, handle, ID) and store snapshot
app.get('/public/youtube/search', async (req, res) => {
  try {
    const q = req.query.q;
    if(!q) return res.status(400).json({ error:'Missing q' });
    const stats = await youtubeApi.searchChannel(q);
    if(!stats) return res.status(404).json({ error:'Channel not found' });
    await youtubeApi.saveSnapshot(stats);
    res.json({ stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'Failed search' });
  }
});

// Channel summary (deltas, grade, earnings estimate)
app.get('/public/youtube/channel/:channelId/summary', async (req, res) => {
  try {
    const summary = await youtubeApi.getChannelSummary(req.params.channelId);
    if(!summary) return res.status(404).json({ error:'Not found' });
    res.json(summary);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'Failed summary' });
  }
});

app.get('/profile', async (req, res) => {
  if (req.user) {
    const identities = await db.getIdentitiesByUserId(req.user.id);
    const linkedProviders = identities.map(i => i.provider);

    let profileHtml = `<h1>You are logged in!</h1>
                       <p>User ID: ${req.user.id}</p>
                       <p>Display Name: ${req.user.display_name}</p>
                       <hr>
                       <h2>Linked Accounts:</h2>`;

    if (linkedProviders.includes('google')) {
      profileHtml += '<p>✅ Google Linked</p>';
    } else {
      profileHtml += '<a href="/auth/google" target="_blank">Link Google Account</a><br>';
    }
    
    if (linkedProviders.includes('twitter')) {
      profileHtml += '<p>✅ Twitter Linked</p>';
    } else {
      profileHtml += '<a href="/auth/twitter" target="_blank">Link Twitter Account</a><br>';
    }
    
    if (linkedProviders.includes('linkedin')) {
      profileHtml += '<p>✅ LinkedIn Linked</p>';
    } else {
      profileHtml += '<a href="/auth/linkedin" target="_blank">Link LinkedIn Account</a><br>';
    }

    profileHtml += `<hr>
                    <h2>Your Analytics API:</h2>
                    <p>View your stats here: <a href="/api/v1/analytics/${req.user.id}" target="_blank">/api/v1/analytics/${req.user.id}</a></p>
                    <hr>
                    <a href="/auth/logout">Logout</a>`;
    res.send(profileHtml);

  } else {
    res.send(
      `<h1>You are not logged in.</h1>
       <a href="/auth/google" target="_blank">Login with Google</a><br>
       <a href="/auth/twitter" target="_blank">Login with Twitter</a><br>
       <a href="/auth/linkedin" target="_blank">Login with LinkedIn</a>`
    );
  }
});

app.get('/api/v1/analytics/:userId', async (req, res) => {
    if (!req.user || req.user.id.toString() !== req.params.userId) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const { userId } = req.params;
    try {
        const totalLikesQuery = db.query('SELECT SUM(like_count) AS total_likes FROM processed_posts WHERE user_id = $1', [userId]);
        const totalRetweetsQuery = db.query('SELECT SUM(retweet_count) AS total_retweets FROM processed_posts WHERE user_id = $1', [userId]);
        const topPostQuery = db.query('SELECT post_text, like_count FROM processed_posts WHERE user_id = $1 ORDER BY like_count DESC LIMIT 1', [userId]);

        const [totalLikesRes, totalRetweetsRes, topPostRes] = await Promise.all([
            totalLikesQuery,
            totalRetweetsQuery,
            topPostQuery
        ]);
        const analytics = {
            totalLikes: parseInt(totalLikesRes.rows[0].total_likes, 10) || 0,
            totalRetweets: parseInt(totalRetweetsRes.rows[0].total_retweets, 10) || 0,
            topPost: topPostRes.rows[0] || null
        };
        res.json(analytics);
    } catch(err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'An error occurred while fetching analytics.' });
    }
});

app.listen(port, async () => {
  try {
    await db.query('SELECT NOW()');
    console.log(`✅ Database connected successfully.`);
    console.log(`🚀 Server is running on http://localhost:${port}`);
  } catch (err) {
    console.error('❌ Failed to connect to the database.', err);
  }
});

// Self analytics (no need to know id on frontend)
app.get('/api/v1/analytics/self', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [likesRes, retweetsRes, topPostRes] = await Promise.all([
      db.query('SELECT COALESCE(SUM(like_count),0) AS total_likes FROM processed_posts WHERE user_id = $1', [userId]),
      db.query('SELECT COALESCE(SUM(retweet_count),0) AS total_retweets FROM processed_posts WHERE user_id = $1', [userId]),
      db.query('SELECT post_text, like_count FROM processed_posts WHERE user_id = $1 ORDER BY like_count DESC LIMIT 1', [userId])
    ]);
    res.json({
      userId,
      totalLikes: parseInt(likesRes.rows[0].total_likes, 10) || 0,
      totalRetweets: parseInt(retweetsRes.rows[0].total_retweets, 10) || 0,
      topPost: topPostRes.rows[0] || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});