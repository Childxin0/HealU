import { ensureUser } from '../models/db.js'
import { computeInsights } from '../services/insightsService.js'
import { ERROR_CODE, classifyError, sendError } from '../utils/errorResponse.js'

export async function insights(req, res) {
  try {
    const q = req.query || {}
    if (q.userId == null || String(q.userId).trim() === '') {
      return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'userId required', 400, false)
    }
    const uid = ensureUser(q.userId)
    const full = await computeInsights(uid)
    res.json({
      dominantEmotion: full.dominantEmotion,
      emotionTrend: full.emotionTrend,
      riskTrend: full.riskTrend,
      checkinRate: full.checkinRate,
      insightSummary: full.insightSummary,
    })
  } catch (e) {
    console.error('[insights]', e)
    return sendError(res, classifyError(e), String(e.message || 'insights failed'), 500, true)
  }
}
