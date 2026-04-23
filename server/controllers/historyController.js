import { ensureUser, all } from '../models/db.js'
import { ERROR_CODE, classifyError, sendError } from '../utils/errorResponse.js'

export function history(req, res) {
  try {
    const q = req.query || {}
    if (q.userId == null || String(q.userId).trim() === '') {
      return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'userId required', 400, false)
    }
    const uid = ensureUser(q.userId)

    const logs = all(
      'SELECT id, text, emotion, context, created_at FROM emotion_logs WHERE user_id = ? ORDER BY id DESC LIMIT 100',
      [uid]
    )

    const checkinRows = all(
      'SELECT id, snapshot, created_at FROM checkins WHERE user_id = ? ORDER BY id DESC LIMIT 100',
      [uid]
    )

    res.json({
      userId: uid,
      emotion_logs: logs,
      checkins: checkinRows.map((c) => ({
        ...c,
        snapshot: safeJson(c.snapshot),
      })),
    })
  } catch (e) {
    console.error('[history]', e)
    return sendError(res, classifyError(e), String(e.message || 'history failed'), 500, true)
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
