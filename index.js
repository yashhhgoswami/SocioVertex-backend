// Load environment variables from .env file
require('dotenv').config();

// --- Module Imports ---
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const db = require('./db');
const authRoutes = require('./auth-routes');
require('./passport-setup'); 
require('./scheduler');

// --- App Initialization ---
const app = express();
const port = 3000;

// --- Middleware Setup ---
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

// --- Routes ---
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Automated Social Media Analytics Tool: Backend is operational.');
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
      profileHtml += '<a href="/auth/google">Link Google Account</a><br>';
    }
    
    if (linkedProviders.includes('twitter')) {
      profileHtml += '<p>✅ Twitter Linked</p>';
    } else {
      profileHtml += '<a href="/auth/twitter">Link Twitter Account</a><br>';
    }
    
    if (linkedProviders.includes('linkedin')) {
      profileHtml += '<p>✅ LinkedIn Linked</p>';
    } else {
      profileHtml += '<a href="/auth/linkedin">Link LinkedIn Account</a><br>';
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
       <a href="/auth/google">Login with Google</a><br>
       <a href="/auth/twitter">Login with Twitter</a><br>
       <a href="/auth/linkedin">Login with LinkedIn</a>`
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


// --- Server Start ---
app.listen(port, async () => {
  try {
    await db.query('SELECT NOW()');
    console.log(`✅ Database connected successfully.`);
    console.log(`🚀 Server is running on http://localhost:${port}`);
  } catch (err) {
    console.error('❌ Failed to connect to the database.', err);
  }
});