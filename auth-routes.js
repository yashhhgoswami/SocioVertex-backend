const router = require('express').Router();
const passport = require('passport');

// --- Google Auth Routes ---
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google'), (req, res) => {
  res.redirect('/profile'); 
});

// --- Twitter Auth Routes ---
router.get('/twitter', passport.authenticate('twitter'));

router.get('/twitter/callback', passport.authenticate('twitter'), (req, res) => {
  res.redirect('/profile');
});

// --- LinkedIn Auth Routes ---
router.get('/linkedin', passport.authenticate('linkedin', { state: 'SOME_RANDOM_STATE_STRING' })); // 'state' is required by LinkedIn

router.get('/linkedin/callback', passport.authenticate('linkedin'), (req, res) => {
  res.redirect('/profile');
});

// --- Logout Route ---
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

module.exports = router;