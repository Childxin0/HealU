import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'healu.db')

const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

let db = null
let SQL = null

function persist() {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function tryRun(sql) {
  try {
    db.run(sql)
  } catch {
    /* 列已存在等 */
  }
}

function migrateSchema() {
  const migrations = [
    'ALTER TABLE emotion_logs ADD COLUMN intensity INTEGER',
    'ALTER TABLE emotion_logs ADD COLUMN secondary_emotion TEXT',
    'ALTER TABLE emotion_logs ADD COLUMN risk_score INTEGER',
    'ALTER TABLE emotion_logs ADD COLUMN risk_level TEXT',
  ]
  for (const sql of migrations) tryRun(sql)

  const logMigrations = [
    'ALTER TABLE logs ADD COLUMN primary_emotion TEXT',
    'ALTER TABLE logs ADD COLUMN secondary_emotion TEXT',
    'ALTER TABLE logs ADD COLUMN intensity INTEGER',
    'ALTER TABLE logs ADD COLUMN context_type TEXT',
    'ALTER TABLE logs ADD COLUMN risk_level TEXT',
    'ALTER TABLE logs ADD COLUMN ai_source TEXT',
    'ALTER TABLE logs ADD COLUMN latency INTEGER',
    'ALTER TABLE logs ADD COLUMN latency_ms INTEGER',
    'ALTER TABLE logs ADD COLUMN fallback_reason TEXT',
    'ALTER TABLE logs ADD COLUMN used_profile INTEGER DEFAULT 0',
    'ALTER TABLE logs ADD COLUMN personalization_score REAL DEFAULT 0',
  ]
  for (const sql of logMigrations) tryRun(sql)

  const profileMigrations = [
    'ALTER TABLE user_profiles ADD COLUMN stress_level_avg REAL DEFAULT 0',
    'ALTER TABLE user_profiles ADD COLUMN breakup_history_count INTEGER DEFAULT 0',
    'ALTER TABLE user_profiles ADD COLUMN negative_bias_score REAL DEFAULT 0',
    'ALTER TABLE user_profiles ADD COLUMN last_updated TEXT',
  ]
  for (const sql of profileMigrations) tryRun(sql)
}

export async function initDb() {
  if (db) return db
  SQL = await initSqlJs()
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emotion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      emotion TEXT,
      context TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      input_text TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      dominant_emotion TEXT,
      stress_level_avg REAL DEFAULT 0,
      breakup_history_count INTEGER DEFAULT 0,
      negative_bias_score REAL DEFAULT 0,
      risk_level TEXT,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS feedback_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emotion_logs_user ON emotion_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_logs(user_id);
  `)
  migrateSchema()
  persist()
  return db
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

export function ensureUser(userId) {
  const database = getDb()
  const id =
    userId != null && String(userId).trim() !== ''
      ? String(userId).trim()
      : `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  database.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [id])
  persist()
  return id
}

export function exec(sql, params = []) {
  const database = getDb()
  database.run(sql, params)
  persist()
}

export function insert(sql, params = []) {
  const database = getDb()
  database.run(sql, params)
  persist()
  const r = database.exec('SELECT last_insert_rowid() AS id')
  const lastInsertRowid =
    r.length && r[0].values && r[0].values[0] ? Number(r[0].values[0][0]) : null
  return { lastInsertRowid }
}

export function all(sql, params = []) {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) {
    out.push(stmt.getAsObject())
  }
  stmt.free()
  return out
}
