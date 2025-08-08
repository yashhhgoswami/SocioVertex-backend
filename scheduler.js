const cron = require('node-cron');
const db = require('./db');
const twitterApi = require('./api/twitter');
const etl = require('./processing/twitter_etl');

/**
 * A task to fetch tweets for all users and then process them.
 * This function now handles the full data pipeline for Twitter.
 */
const fetchAllTweetsAndProcess = async () => {
  console.log('Scheduler running: Starting full data pipeline job...');
  
  // --- Part 1: Fetch Raw Tweets ---
  try {
    // Get all users who have a Twitter account linked.
    const res = await db.query(`
        SELECT u.id, i.provider_id 
        FROM users u 
        JOIN identities i ON u.id = i.user_id 
        WHERE i.provider = 'twitter'
    `);
    const twitterUsers = res.rows;
    console.log(`Found ${twitterUsers.length} user(s) with a linked Twitter account.`);

    // Loop through each user and fetch their tweets.
    for (const user of twitterUsers) {
      const tweets = await twitterApi.getLatestTweetsForUser(user.id);

      // If we got tweets, save them to the raw_tweets table.
      if (tweets.length > 0) {
        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');
          for (const tweet of tweets) {
            // Using ON CONFLICT ensures we don't save duplicate tweets.
            await client.query(`
              INSERT INTO raw_tweets (tweet_id, author_user_id, tweet_text, tweet_created_at, raw_data)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (tweet_id) DO NOTHING
            `, [tweet.id, user.id, tweet.text, tweet.created_at, tweet]);
          }
          await client.query('COMMIT');
          console.log(`Saved ${tweets.length} raw tweets for user #${user.id}.`);
        } catch (e) {
          await client.query('ROLLBACK');
          console.error(`Error saving raw tweets for user #${user.id}:`, e);
        } finally {
          client.release();
        }
      }
    }
  } catch (err) {
    console.error('Error during the raw tweet fetching job:', err);
  }

  // --- Part 2: Process Raw Data into Analytics Table ---
  console.log('Scheduler finished raw data fetching. Starting ETL processing...');
  await etl.processRawTweets(); 

  console.log('Scheduler finished full data pipeline job.');
};


// Schedule the task to run every 15 minutes.
cron.schedule('*/15 * * * *', fetchAllTweetsAndProcess);

console.log('✅ Cron job for full Twitter data pipeline has been scheduled to run every 15 minutes.');