import { runAnalyze } from '../services/analyzeService.js'
import { analyzeEmotion } from '../lib/emotion/emotionAnalyzer.js'
import { ensureUser, insert, exec, all } from '../models/db.js'
import { computeRisk, isCriticalRisk } from '../services/riskEngine.js'
import { updateUserProfile, getUserProfileForPrompt } from '../services/userModelingService.js'
import { classifyError, ERROR_CODE, sendError } from '../utils/errorResponse.js'

const CRITICAL_MSG = '【紧急干预】你现在的描述显示高危信号，请立刻联系家人、当地心理援助热线或急救资源。'
const HIGH_RISK_HINT = '\n\n⚠️ 你提到的状态风险较高，建议尽快联系可信任的人并获取线下支持。'

/**
 * @param {Record<string, unknown>} longTerm
 * @param {unknown} client
 */
function mergeProfileForPrompt(longTerm, client) {
  const base = longTerm && typeof longTerm === 'object' ? { ...longTerm } : {}
  if (client && typeof client === 'object') {
    const c = /** @type {Record<string, unknown>} */ (client)
    if (c.name != null) base.name = c.name
    if (c.notes != null) base.notes = c.notes
  }
  return base
}

export async function analyze(req, res) {
  try {
    const { userId, text, profile: clientProfile } = req.body || {}
    const uid = ensureUser(userId)
    const rawText = String(text || '')

    if (!rawText.trim()) {
      return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'text is required', 400, false)
    }

    const longTerm = getUserProfileForPrompt(uid)
    const mergedProfile = mergeProfileForPrompt(longTerm, clientProfile)

    const rows = all(
      `SELECT emotion, context FROM emotion_logs
       WHERE user_id = ? AND emotion IS NOT NULL AND emotion != ''
       ORDER BY id DESC LIMIT 3`,
      [uid]
    )
    const history = rows.map((r) => ({
      emotion: r.emotion,
      context: r.context,
    }))

    const ins = insert('INSERT INTO emotion_logs (user_id, text) VALUES (?, ?)', [uid, rawText])
    const logRowId = ins.lastInsertRowid

    const local = analyzeEmotion(rawText)
    const preRisk = computeRisk({
      text: rawText,
      intensity: local.intensity,
      primaryEmotion: local.primaryEmotion,
      secondaryEmotion: local.secondaryEmotion,
      contextType: local.contextType,
    })

    if (isCriticalRisk(preRisk.riskLevel)) {
      const result = {
        primaryEmotion: local.primaryEmotion,
        secondaryEmotion: local.secondaryEmotion,
        intensity: local.intensity,
        contextType: local.contextType,
        responseText: CRITICAL_MSG,
        _aiMeta: { aiSource: 'local', latencyMs: 0, latency: 0, fallback: true, fallbackReason: 'CRITICAL_RISK' },
      }
      finalizeLog(uid, rawText, logRowId, result, preRisk)
      updateUserProfile(uid, { ...result, riskLevel: preRisk.riskLevel })
      return res.json({
        emotion: result.primaryEmotion,
        context: result.contextType,
        riskLevel: preRisk.riskLevel,
        responseText: result.responseText,
      })
    }

    const result = await runAnalyze(rawText, {
      history,
      profile: mergedProfile,
      userId: uid,
    })

    const postRisk = computeRisk({
      text: rawText,
      intensity: result.intensity,
      primaryEmotion: result.primaryEmotion,
      secondaryEmotion: result.secondaryEmotion,
      contextType: result.contextType,
    })

    const finalResult =
      postRisk.riskLevel === 'high'
        ? { ...result, responseText: `${result.responseText}${HIGH_RISK_HINT}` }
        : result

    finalizeLog(uid, rawText, logRowId, finalResult, postRisk)
    updateUserProfile(uid, { ...finalResult, riskLevel: postRisk.riskLevel })

    res.json({
      emotion: finalResult.primaryEmotion,
      context: finalResult.contextType,
      riskLevel: postRisk.riskLevel,
      responseText: finalResult.responseText,
    })
  } catch (e) {
    console.error('[analyze]', e)
    return sendError(res, classifyError(e), String(e.message || 'analyze failed'), 500, true)
  }
}

/**
 * @param {string} uid
 * @param {string} rawText
 * @param {number} logRowId
 * @param {*} result
 * @param {{ riskScore: number, riskLevel: string }} risk
 */
function finalizeLog(uid, rawText, logRowId, result, risk) {
  exec(
    `UPDATE emotion_logs SET
      emotion = ?, context = ?, secondary_emotion = ?, intensity = ?,
      risk_score = ?, risk_level = ?
     WHERE id = ?`,
    [
      result.primaryEmotion,
      result.contextType,
      result.secondaryEmotion,
      result.intensity,
      risk.riskScore,
      risk.riskLevel,
      logRowId,
    ]
  )

  const aiPayload = {
    primaryEmotion: result.primaryEmotion,
    secondaryEmotion: result.secondaryEmotion,
    intensity: result.intensity,
    contextType: result.contextType,
    responseText: result.responseText,
    meta: result._aiMeta || {},
  }

  insert(
    `INSERT INTO logs (
      user_id, input_text, ai_response,
      primary_emotion, secondary_emotion, intensity, context_type,
      risk_level, ai_source, latency, latency_ms, fallback_reason,
      used_profile, personalization_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      rawText,
      safeStringify(aiPayload),
      result.primaryEmotion,
      result.secondaryEmotion,
      result.intensity,
      result.contextType,
      risk.riskLevel,
      result._aiMeta?.aiSource || 'local',
      Math.round(Number(result._aiMeta?.latencyMs) || 0),
      Math.round(Number(result._aiMeta?.latencyMs) || 0),
      result._aiMeta?.fallbackReason || '',
      result.usedProfile ? 1 : 0,
      Number(result.personalizationScore || 0),
    ]
  )
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj)
  } catch {
    return '{}'
  }
}
