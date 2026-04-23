"use strict";
const core_storage = require("./storage.js");
const KEY = "healU_recent_generated";
const TAG_KEY = "healU_recent_tags";
function hashStr(s) {
  let h = 5381;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++)
    h = h * 33 ^ t.charCodeAt(i);
  return String(h >>> 0);
}
function getEntries() {
  const raw = core_storage.storageGet(KEY);
  return Array.isArray(raw) ? raw : [];
}
function getTagHashes() {
  const raw = core_storage.storageGet(TAG_KEY);
  return Array.isArray(raw) ? raw : [];
}
function rememberGenerated(kind, text) {
  const t = String(text || "").trim();
  if (!t)
    return;
  const h = hashStr(t);
  const list = getEntries();
  list.push({ kind, hash: h });
  core_storage.storageSet(KEY, list.slice(-10));
  if (kind === "tag") {
    const tags = getTagHashes();
    tags.push(h);
    core_storage.storageSet(TAG_KEY, tags.slice(-5));
  }
}
function isBlocked(kind, text) {
  const t = String(text || "").trim();
  if (!t)
    return true;
  const h = hashStr(t);
  const list = getEntries();
  if (list.some((e) => e.hash === h))
    return true;
  if (kind === "tag" && getTagHashes().includes(h))
    return true;
  return false;
}
function uniqueLine(kind, factory, maxAttempts = 48) {
  for (let i = 0; i < maxAttempts; i++) {
    const line = factory();
    if (!isBlocked(kind, line)) {
      rememberGenerated(kind, line);
      return line;
    }
  }
  const fallback = `${factory()} ·${Date.now() % 1e4}`;
  rememberGenerated(kind, fallback);
  return fallback;
}
exports.uniqueLine = uniqueLine;
