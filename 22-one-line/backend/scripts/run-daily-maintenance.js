/**
 * Manual: node scripts/run-daily-maintenance.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { runDailyMaintenance } = require('../jobs/dailyMaintenance');

runDailyMaintenance('cli')
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
