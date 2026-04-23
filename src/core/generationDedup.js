/**
 * 生成去重：healU_recent_generated 保留最近 10 条；
 * 标签额外约束：最近 5 条 tag 不可重复
 */

import { storageGet, storageSet } from './storage.js'

const KEY = 'healU_recent_generated'
const TAG_KEY = 'healU_recent_tags'

function hashStr(s) {
  let h = 5381
  const t = String(s || '')
  for (let i = 0; i < t.length; i++) h = (h * 33) ^ t.charCodeAt(i)
  return String(h >>> 0)
}

function getEntries() {
  const raw = storageGet(KEY)
  return Array.isArray(raw) ? raw : []
}

function getTagHashes() {
  const raw = storageGet(TAG_KEY)
  return Array.isArray(raw) ? raw : []
}

/**
 * @param {'tag'|'empathy'|'action'|'avoid'|'metaphor'} kind
 * @param {string} text
 */
export function rememberGenerated(kind, text) {
  const t = String(text || '').trim()
  if (!t) return
  const h = hashStr(t)
  const list = getEntries()
  list.push({ kind, hash: h })
  storageSet(KEY, list.slice(-10))
  if (kind === 'tag') {
    const tags = getTagHashes()
    tags.push(h)
    storageSet(TAG_KEY, tags.slice(-5))
  }
}

/**
 * @param {'tag'|'empathy'|'action'|'avoid'|'metaphor'} kind
 * @param {string} text
 */
export function isBlocked(kind, text) {
  const t = String(text || '').trim()
  if (!t) return true
  const h = hashStr(t)
  const list = getEntries()
  if (list.some((e) => e.hash === h)) return true
  if (kind === 'tag' && getTagHashes().includes(h)) return true
  return false
}

/**
 * @param {'tag'|'empathy'|'action'|'avoid'|'metaphor'} kind
 * @param {() => string} factory
 * @param {number} maxAttempts
 */
export function uniqueLine(kind, factory, maxAttempts = 48) {
  for (let i = 0; i < maxAttempts; i++) {
    const line = factory()
    if (!isBlocked(kind, line)) {
      rememberGenerated(kind, line)
      return line
    }
  }
  const fallback = `${factory()} ·${Date.now() % 10000}`
  rememberGenerated(kind, fallback)
  return fallback
}
