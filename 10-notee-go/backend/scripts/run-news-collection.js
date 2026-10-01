/**
 * Manual: node scripts/run-news-collection.js
 */

const { pool } = require('../database/connection');
const { runNewsCollection } = require('../jobs/newsCollection');

runNewsCollection('cli')
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
