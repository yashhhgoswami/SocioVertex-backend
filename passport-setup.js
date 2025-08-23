const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const db = require('./db');

passport.serializeUser((user, done) => {
    done(null, user.id); 
});

passport.deserializeUser(async (id, done) => {
  try {
    const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      const user = res.rows[0];
      done(null, user);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (err) {
    done(err, null);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const user = await db.findOrCreateUser(req.user, 'google', profile, accessToken);
        console.log('User found or created:', user); 
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Twitter Strategy
passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: '/auth/twitter/callback',
      passReqToCallback: true
    },
    async (req, token, tokenSecret, profile, done) => {
      try {
        const user = await db.findOrCreateUser(req.user, 'twitter', profile, token, tokenSecret);
        console.log('User found or created:', user); 
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// LinkedIn Strategy
passport.use(
  new LinkedInStrategy(
    {
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: '/auth/linkedin/callback',
      scope: ['r_liteprofile', 'r_emailaddress'],
      passReqToCallback: true,
    },

    
    async (req, accessToken, refreshToken, profile, done) => {
        // ADD THESE TWO LINES FOR DEBUGGING
      console.log(process.env.LINKEDIN_CLIENT_ID)
      console.log('--- LINKEDIN STRATEGY EXECUTING ---');
      console.log('LinkedIn Profile Received:', profile.displayName);
      try {
        const user = await db.findOrCreateUser(req.user, 'linkedin', profile, accessToken);
        console.log('User found or created:', user);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);