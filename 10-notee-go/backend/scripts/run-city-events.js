/**
 * Manual: node scripts/run-city-events.js
 */

const { pool } = require('../database/connection');
const { runCityEventCollection } = require('../jobs/cityEventCollection');

runCityEventCollection('cli')
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
