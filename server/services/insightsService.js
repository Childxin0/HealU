import { all } from '../models/db.js'
import { generateInsightSummary } from './insightsSummary.js'

/**
 * @param {string} userId
 */
export async function computeInsights(userId) {
  const uid = String(userId || '').trim()

  const profRows = all(`SELECT dominant_emotion, risk_level FROM user_profiles WHERE user_id = ? LIMIT 1`, [uid])
  const prof = profRows[0]

  const dominantEmotion = prof?.dominant_emotion ?? null
  const emotionTrend = computeEmotionTrend(uid)
  const riskTrend = computeRiskTrend(uid)

  const checkinRows = all(
    `SELECT created_at FROM checkins
     WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-7 days')`,
    [uid]
  )
  const checkinRate = computeCheckinRate(checkinRows)

  const summary = await generateInsightSummary(uid)

  return {
    dominantEmotion,
    emotionTrend,
    riskTrend,
    checkinRate,
    insightSummary: summary,
  }
}

/**
 * @param {Array<{ created_at: string }>} checkinRows
 */
function computeCheckinRate(checkinRows) {
  const days = new Set()
  for (const r of checkinRows) {
    const d = String(r.created_at || '').slice(0, 10)
    if (d) days.add(d)
  }
  const rate = Math.round((days.size / 7) * 1000) / 1000
  return Math.min(1, Math.max(0, rate))
}

function computeEmotionTrend(uid) {
  const rows = all(
    `SELECT emotion FROM emotion_logs
     WHERE user_id = ? AND emotion IS NOT NULL AND emotion != ''
     ORDER BY id DESC LIMIT 10`,
    [uid]
  )
  if (rows.length < 4) return 'stable'
  const neg = new Set(['anxious', 'low_energy', 'unstable', 'sad'])
  const first = rows.slice(5)
  const second = rows.slice(0, 5)
  const ratio = (arr) => (arr.length ? arr.filter((x) => neg.has(String(x.emotion))).length / arr.length : 0)
  const diff = ratio(second) - ratio(first)
  if (diff > 0.2) return 'worsening'
  if (diff < -0.2) return 'improving'
  return 'stable'
}

function computeRiskTrend(uid) {
  const rows = all(
    `SELECT risk_level FROM emotion_logs
     WHERE user_id = ? AND risk_level IS NOT NULL AND risk_level != ''
     ORDER BY id DESC LIMIT 8`,
    [uid]
  )
  if (!rows.length) return 'low'
  if (rows.some((r) => String(r.risk_level) === 'critical')) return 'critical'
  if (rows.some((r) => String(r.risk_level) === 'high')) return 'high'
  if (rows.some((r) => String(r.risk_level) === 'medium')) return 'medium'
  return 'low'
}
