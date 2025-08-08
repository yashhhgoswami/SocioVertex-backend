const db = require('../db');

/**
 * This function will run our ETL process for Twitter data.
 * 1. EXTRACTS raw data from the 'raw_tweets' table.
 * 2. TRANSFORMS it into a clean format.
 * 3. LOADS it into the 'processed_posts' table.
 */
const processRawTweets = async () => {
    console.log('ETL Process Starting: Looking for new raw tweets...');

    // 1. EXTRACT: Get all raw tweets that have not been processed yet.
    // We do this by finding tweets in 'raw_tweets' whose IDs are not yet in 'processed_posts'.
    const res = await db.query(`
        SELECT * FROM raw_tweets
        WHERE tweet_id NOT IN (SELECT source_post_id FROM processed_posts WHERE source_provider = 'twitter')
    `);

    const newTweets = res.rows;
    if (newTweets.length === 0) {
        console.log('ETL Process: No new tweets to process.');
        return;
    }

    console.log(`ETL Process: Found ${newTweets.length} new tweets to transform and load.`);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (const rawTweet of newTweets) {
            // 2. TRANSFORM: Pull the clean data out of the messy 'raw_data' JSON object.
            // The ?. is 'optional chaining' - it prevents errors if a value doesn't exist.
            const tweetData = rawTweet.raw_data;
            const cleanData = {
                userId: rawTweet.author_user_id,
                provider: 'twitter',
                postId: tweetData.id,
                text: tweetData.text,
                createdAt: tweetData.created_at,
                likes: tweetData.public_metrics?.like_count || 0,
                retweets: tweetData.public_metrics?.retweet_count || 0,
                replies: tweetData.public_metrics?.reply_count || 0,
                quotes: tweetData.public_metrics?.quote_count || 0,
            };

            // 3. LOAD: Insert the clean data into our 'processed_posts' table.
            await client.query(`
                INSERT INTO processed_posts 
                    (user_id, source_provider, source_post_id, post_text, post_created_at, like_count, retweet_count, reply_count, quote_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (source_post_id) DO NOTHING
            `, [
                cleanData.userId,
                cleanData.provider,
                cleanData.postId,
                cleanData.text,
                cleanData.createdAt,
                cleanData.likes,
                cleanData.retweets,
                cleanData.replies,
                cleanData.quotes
            ]);
        }
        
        await client.query('COMMIT');
        console.log(`ETL Process: Successfully processed ${newTweets.length} tweets.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ETL Process Error:', e);
    } finally {
        client.release();
    }
};

module.exports = {
    processRawTweets,
};