import { ensureUser, insert } from '../models/db.js'
import { classifyError, sendError } from '../utils/errorResponse.js'

export function checkin(req, res) {
  try {
    const { userId, emotionSnapshot } = req.body || {}
    const uid = ensureUser(userId)
    const snapshot = JSON.stringify(emotionSnapshot ?? {})
    const r = insert('INSERT INTO checkins (user_id, snapshot) VALUES (?, ?)', [uid, snapshot])
    res.json({ ok: true, id: r.lastInsertRowid, userId: uid })
  } catch (e) {
    console.error('[checkin]', e)
    return sendError(res, classifyError(e), String(e.message || 'checkin failed'), 500, true)
  }
}
