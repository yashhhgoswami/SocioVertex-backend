const { Pool } = require('pg');

// Create a new pool instance.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

/**
 * Finds a user by their provider identity or creates a new user and identity.
 * This function now handles both new sign-ups and linking accounts to an existing user.
 * @param {object | null} currentUser - The currently logged-in user object (req.user), or null if not logged in.
 * @param {string} provider - 'google', 'twitter', etc.
 * @param {object} profile - The profile object from Passport.
 * @param {string} token - The access token from the provider.
 * @param {string} [tokenSecret] - The token secret (only for Twitter).
 * @returns {Promise<object>} The user record from the 'users' table.
 */
const findOrCreateUser = async (currentUser, provider, profile, token, tokenSecret) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (currentUser) {
            // SCENARIO 1: A user is already logged in. We are LINKING a new account.
            await client.query(
                'INSERT INTO identities (user_id, provider, provider_id, access_token, access_token_secret) VALUES ($1, $2, $3, $4, $5)',
                [currentUser.id, provider, profile.id, token, tokenSecret]
            );
            await client.query('COMMIT');
            console.log(`Linked new ${provider} account to existing user #${currentUser.id}`);
            return currentUser;

        } else {
            // SCENARIO 2: No user is logged in. This is a fresh LOGIN or SIGN UP.
            let identityRes = await client.query(
                'SELECT * FROM identities WHERE provider = $1 AND provider_id = $2',
                [provider, profile.id]
            );

            if (identityRes.rows.length > 0) {
                // User has logged in before with this social account. Find them.
                const identity = identityRes.rows[0];
                const userRes = await client.query('SELECT * FROM users WHERE id = $1', [identity.user_id]);
                await client.query('COMMIT');
                console.log(`Found existing user #${userRes.rows[0].id} via ${provider}.`);
                return userRes.rows[0];
            } else {
                // This is a brand new user. Create them.
                const userRes = await client.query(
                    "INSERT INTO users (display_name, avatar_url) VALUES ($1, $2) RETURNING *",
                    [profile.displayName, profile.photos ? profile.photos[0].value : null]
                );
                const newUser = userRes.rows[0];
                await client.query(
                    'INSERT INTO identities (user_id, provider, provider_id, access_token, access_token_secret) VALUES ($1, $2, $3, $4, $5)',
                    [newUser.id, provider, profile.id, token, tokenSecret]
                );
                await client.query('COMMIT');
                console.log(`Created new user #${newUser.id} via ${provider}.`);
                return newUser;
            }
        }
    } catch (err) {
        await client.query('ROLLBACK'); // If anything fails, undo all changes
        console.error("DATABASE ERROR:", err);
        throw err;
    } finally {
        client.release(); // Release the client back to the pool
    }
};

/**
 * Gets all provider identities for a given user ID.
 * @param {number} userId - The user's ID from the 'users' table.
 * @returns {Promise<Array>} A promise that resolves to an array of identity objects.
 */
const getIdentitiesByUserId = async (userId) => {
  const res = await pool.query('SELECT provider FROM identities WHERE user_id = $1', [userId]);
  return res.rows;
};

// Export all the functions
module.exports = {
  query: (text, params) => pool.query(text, params),
  findOrCreateUser,
  getIdentitiesByUserId,
};

// At the bottom of db.js
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  findOrCreateUser,
  getIdentitiesByUserId,
};