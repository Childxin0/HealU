import { all, exec } from '../models/db.js'

const NEGATIVE_EMOTIONS = new Set(['anxious', 'low_energy', 'unstable', 'sad'])

export function getUserProfileForPrompt(userId) {
  const uid = String(userId || '').trim()
  const r = all(`SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1`, [uid])[0]
  if (!r) {
    return {
      dominantEmotion: 'reflective',
      stressLevelAvg: 0,
      breakupHistoryCount: 0,
      negativeBiasScore: 0,
      riskLevel: 'low',
    }
  }
  return {
    dominantEmotion: r.dominant_emotion || 'reflective',
    stressLevelAvg: Number(r.stress_level_avg || 0),
    breakupHistoryCount: Number(r.breakup_history_count || 0),
    negativeBiasScore: Number(r.negative_bias_score || 0),
    riskLevel: String(r.risk_level || 'low'),
  }
}

/**
 * @param {string} userId
 * @param {{ primaryEmotion: string, intensity: number, contextType: string, riskLevel?: string }} analysis
 */
export function updateUserProfile(userId, analysis) {
  const uid = String(userId || '').trim()
  const now = new Date().toISOString()
  const current = getUserProfileForPrompt(uid)
  const oldStress = Number(current.stressLevelAvg || 0)
  const newIntensity = Math.min(100, Math.max(0, Number(analysis?.intensity || 0)))
  const stressLevelAvg = Number((oldStress * 0.7 + newIntensity * 0.3).toFixed(2))

  const isNegative = NEGATIVE_EMOTIONS.has(String(analysis?.primaryEmotion || ''))
  const negativeBiasScore = Math.max(0, Number(current.negativeBiasScore || 0) + (isNegative ? 1 : -0.4))
  const breakupHistoryCount =
    Number(current.breakupHistoryCount || 0) + (String(analysis?.contextType || '') === 'breakup' ? 1 : 0)

  const dom = inferDominantEmotion(uid, analysis?.primaryEmotion)
  const riskLevel = String(analysis?.riskLevel || current.riskLevel || 'low')

  exec(
    `INSERT INTO user_profiles (
      user_id, dominant_emotion, stress_level_avg, breakup_history_count,
      negative_bias_score, risk_level, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      dominant_emotion = excluded.dominant_emotion,
      stress_level_avg = excluded.stress_level_avg,
      breakup_history_count = excluded.breakup_history_count,
      negative_bias_score = excluded.negative_bias_score,
      risk_level = excluded.risk_level,
      last_updated = excluded.last_updated`,
    [uid, dom, stressLevelAvg, breakupHistoryCount, Number(negativeBiasScore.toFixed(2)), riskLevel, now]
  )
}

function inferDominantEmotion(uid, fallback) {
  const rows = all(
    `SELECT emotion, COUNT(1) AS c FROM emotion_logs
     WHERE user_id = ? AND emotion IS NOT NULL AND emotion != ''
     GROUP BY emotion ORDER BY c DESC LIMIT 1`,
    [uid]
  )
  return rows[0]?.emotion || fallback || 'reflective'
}
