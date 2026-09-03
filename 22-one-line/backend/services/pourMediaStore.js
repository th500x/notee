/**
 * Private JPEG crops on local disk (same VPS as the API).
 * Not nginx-static: only GET with the owner's JWT.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { assertSittingId, assertSlot, assertUserId } = require('../lib/pourMedia');

function rootDir() {
  return process.env.POUR_MEDIA_DIR
    ? path.resolve(process.env.POUR_MEDIA_DIR)
    : path.join(__dirname, '../../data/pour-media');
}

function sittingDir(userId, sittingId) {
  return path.join(rootDir(), assertUserId(userId), assertSittingId(sittingId));
}

function filePath(userId, sittingId, slot) {
  return path.join(sittingDir(userId, sittingId), `${assertSlot(slot)}.jpg`);
}

async function put(userId, sittingId, slot, buffer) {
  const dest = filePath(userId, sittingId, slot);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  await fsp.writeFile(tmp, buffer);
  await fsp.rename(tmp, dest);
}

function exists(userId, sittingId, slot) {
  return fs.existsSync(filePath(userId, sittingId, slot));
}

function absolutePath(userId, sittingId, slot) {
  const dest = filePath(userId, sittingId, slot);
  return fs.existsSync(dest) ? dest : null;
}

async function deleteSitting(userId, sittingId) {
  await fsp.rm(sittingDir(userId, sittingId), { recursive: true, force: true });
}

async function deleteUser(userId) {
  if (!userId) return;
  await fsp.rm(path.join(rootDir(), assertUserId(userId)), { recursive: true, force: true });
}

async function pruneToIds(userId, keepIds) {
  const uid = assertUserId(userId);
  const userRoot = path.join(rootDir(), uid);
  let names;
  try {
    names = await fsp.readdir(userRoot);
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
  const keep = new Set(keepIds);
  await Promise.all(
    names.map(async (name) => {
      if (keep.has(name)) return;
      await fsp.rm(path.join(userRoot, name), { recursive: true, force: true });
    })
  );
}

module.exports = {
  rootDir,
  put,
  exists,
  absolutePath,
  deleteSitting,
  deleteUser,
  pruneToIds,
};
