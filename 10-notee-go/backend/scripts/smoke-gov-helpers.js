/** Tiny helpers for local smoke: node scripts/smoke-gov-helpers.js hide|ban <uuid> */
const { query } = require('../database/connection');

async function main() {
  const [cmd, id] = process.argv.slice(2);
  if (!cmd || !id) {
    console.error('usage: hide|ban <uuid>');
    process.exit(1);
  }
  if (cmd === 'hide') {
    await query('UPDATE posts SET hidden_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    console.log('hidden');
  } else if (cmd === 'ban') {
    await query("UPDATE users SET status = 'banned' WHERE id = ?", [id]);
    console.log('banned');
  } else {
    console.error('unknown cmd');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
