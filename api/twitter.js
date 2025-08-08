const { TwitterApi } = require('twitter-api-v2');
const db = require('../db'); // We need our db file

/**
 * Fetches the latest tweets for a given internal user ID.
 * @param {number} userId - The ID of the user from our 'users' table.
 * @returns {Promise<Array>} A promise that resolves to an array of tweet objects.
 */
const getLatestTweetsForUser = async (userId) => {
  console.log(`Fetching tweets for user ID: ${userId}`);
  
  // 1. Get the user's stored Twitter keys from our database.
  const identityRes = await db.query(
    'SELECT * FROM identities WHERE user_id = $1 AND provider = $2',
    [userId, 'twitter']
  );

  if (identityRes.rows.length === 0) {
    throw new Error('No Twitter identity found for this user.');
  }

  const identity = identityRes.rows[0];
  const { access_token, access_token_secret, provider_id } = identity;

  // 2. Create a Twitter API client authenticated as that specific user.
  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: access_token,
    accessSecret: access_token_secret,
  });

  // 3. Use the client to fetch data from the user's timeline.
  try {
    const timeline = await client.v2.userTimeline(provider_id, { 
        'max_results': 10,
        // Add more fields you want to get from the API
        'tweet.fields': ['created_at', 'public_metrics'],
    });

    console.log(`Successfully fetched ${timeline.data.data?.length || 0} tweets for user #${userId}.`);
    return timeline.data.data || []; // Return the array of tweets, or an empty array
  } catch (error) {
    console.error(`Could not fetch tweets for user #${userId}:`, error);
    return []; // Return an empty array on failure
  }
};

module.exports = {
  getLatestTweetsForUser,
};