import { ensureUser, insert } from '../models/db.js'
import { ERROR_CODE, classifyError, sendError } from '../utils/errorResponse.js'

export function feedback(req, res) {
  try {
    const { userId, message_id, rating } = req.body || {}
    const uid = ensureUser(userId)
    const mid = Number(message_id)
    const r = Number(rating)
    if (!Number.isFinite(mid) || mid <= 0) {
      return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'message_id must be a positive number', 400, false)
    }
    if (!Number.isFinite(r) || r < 1 || r > 5 || Math.floor(r) !== r) {
      return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'rating must be integer 1-5', 400, false)
    }
    insert(`INSERT INTO feedback_logs (user_id, message_id, rating) VALUES (?, ?, ?)`, [uid, mid, r])
    res.json({ ok: true })
  } catch (e) {
    console.error('[feedback]', e)
    return sendError(res, classifyError(e), String(e.message || 'feedback failed'), 500, true)
  }
}
