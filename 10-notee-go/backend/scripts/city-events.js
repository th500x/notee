/**
 * City Events by hand. Not a public API.
 * Usage:
 *   node scripts/city-events.js list
 *   node scripts/city-events.js add --region pty --title "Pattaya International Fireworks Festival 2026" --start 2026-11-27 --end 2026-11-28 --place "Pattaya Beach, Pattaya"
 *   node scripts/city-events.js hide --id 12
 *   node scripts/city-events.js unhide --id 12
 *   node scripts/city-events.js delete --id 12     # hand-entered rows only
 */

const { pool } = require('../database/connection');
const {
  addCityEvent,
  setCityEventHidden,
  deleteManualCityEvent,
  listStoredCityEvents,
} = require('../services/cityEventService');

const USAGE =
  'Usage: node scripts/city-events.js list | add --region bkk|pty --title "…" --start YYYY-MM-DD [--end YYYY-MM-DD] --place "…" | hide|unhide|delete --id <id>';

function option(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function idOption(args) {
  const id = Number(option(args, 'id'));
  if (!Number.isInteger(id) || id <= 0) throw new Error(USAGE);
  return id;
}

async function run(command, args) {
  switch (command) {
    case 'list': {
      for (const row of await listStoredCityEvents()) {
        const days = row.startDayKey === row.endDayKey ? row.startDayKey : `${row.startDayKey}..${row.endDayKey}`;
        console.log(
          `${row.id}\t${row.regionId}\t${days}\t${row.hidden ? 'HIDDEN\t' : ''}${row.title}\t@ ${row.place || '-'}\t${row.publisher}`
        );
      }
      return;
    }
    case 'add': {
      const startDayKey = option(args, 'start');
      const created = await addCityEvent({
        regionId: option(args, 'region'),
        title: option(args, 'title'),
        startDayKey,
        endDayKey: option(args, 'end') || startDayKey,
        place: option(args, 'place'),
      });
      console.log(JSON.stringify({ ok: true, ...created }));
      return;
    }
    case 'hide':
    case 'unhide':
      await setCityEventHidden(idOption(args), command === 'hide');
      console.log(JSON.stringify({ ok: true }));
      return;
    case 'delete':
      await deleteManualCityEvent(idOption(args));
      console.log(JSON.stringify({ ok: true }));
      return;
    default:
      throw new Error(USAGE);
  }
}

const [command, ...args] = process.argv.slice(2);
run(command, args)
  .catch((err) => {
    console.error(err.code ? `${err.code} ${err.message}` : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
