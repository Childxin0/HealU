import { analyzeEmotion } from '../lib/emotion/emotionAnalyzer.js'
import { runAnalyze } from '../services/analyzeService.js'
import { computeRisk, isCriticalRisk, KEYWORD_RULES, CRITICAL_TRIGGERS, EMOTION_WEIGHT, SECONDARY_EMOTION_WEIGHT, CONTEXT_WEIGHT } from '../services/riskEngine.js'
import { ensureUser, all } from '../models/db.js'
import { getUserProfileForPrompt } from '../services/userModelingService.js'
import { classifyError, ERROR_CODE, sendError } from '../utils/errorResponse.js'
 
const CRITICAL_MSG = '【紧急干预】你现在的描述显示高危信号，请立刻联系家人、当地心理援助热线或急救资源。'

export async function debugAnalyze(req, res) {
  try {
    const payload = req.method === 'GET' ? req.query || {} : req.body || {}
    const { userId, text, profile: clientProfile } = payload
    const rawText = String(text || '').trim()
    if (!rawText) return sendError(res, ERROR_CODE.VALIDATION_ERROR, 'text is required', 400, false)

    const uid = ensureUser(userId)
    const profile = { ...getUserProfileForPrompt(uid), ...(clientProfile || {}) }
    const history = all(
      `SELECT emotion, context FROM emotion_logs
       WHERE user_id = ? AND emotion IS NOT NULL AND emotion != ''
       ORDER BY id DESC LIMIT 3`,
      [uid]
    ).map((r) => ({ emotion: r.emotion, context: r.context }))

    const local = analyzeEmotion(rawText)
    const detectedKeywords = extractDetectedKeywords(rawText, local.keywordsMatched)
    const risk = computeRisk({
      text: rawText,
      intensity: local.intensity,
      primaryEmotion: local.primaryEmotion,
      secondaryEmotion: local.secondaryEmotion,
      contextType: local.contextType,
    })
    const riskReason = explainRisk({
      text: rawText,
      intensity: local.intensity,
      primaryEmotion: local.primaryEmotion,
      secondaryEmotion: local.secondaryEmotion,
      contextType: local.contextType,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
    })

    if (isCriticalRisk(risk.riskLevel)) {
      return res.json({
        input: rawText,
        detectedKeywords,
        contextType: local.contextType,
        riskLevel: risk.riskLevel,
        riskReason,
        fallback: true,
        latency: 0,
        responseText: CRITICAL_MSG,
      })
    }

    const result = await runAnalyze(rawText, { history, profile, userId: uid })
    return res.json({
      input: rawText,
      detectedKeywords,
      contextType: result.contextType,
      riskLevel: risk.riskLevel,
      riskReason,
      fallback: Boolean(result._aiMeta?.fallback),
      latency: Number(result._aiMeta?.latencyMs || 0),
    })
  } catch (e) {
    return sendError(res, classifyError(e), String(e.message || 'debug failed'), 500, true)
  }
}

function extractDetectedKeywords(text, contextKeywords) {
  const src = String(text || '')
  const fromContextSignals = Array.isArray(contextKeywords) ? contextKeywords.map((x) => String(x || '').trim()).filter(Boolean) : []
  const fromRiskKeywords = []
  for (const rule of KEYWORD_RULES) {
    for (const k of rule.keys) {
      if (src.includes(k)) {
        fromRiskKeywords.push(k)
        break
      }
    }
  }
  const symptomLexicon = ['胸痛', '呼吸困难', '失眠', '出冷汗', '心慌', '头痛', '胃痛', '没胃口']
  const symptomHits = symptomLexicon.filter((k) => src.includes(k))
  return Array.from(new Set([...fromContextSignals, ...fromRiskKeywords, ...symptomHits]))
}

function explainRisk({ text, intensity, primaryEmotion, secondaryEmotion, contextType, riskLevel, riskScore }) {
  const chunks = []
  const src = String(text || '')

  const criticalHit = CRITICAL_TRIGGERS.find((k) => src.includes(k))
  if (criticalHit) chunks.push(`命中 critical 触发词「${criticalHit}」`)

  const keywordHits = []
  for (const rule of KEYWORD_RULES) {
    const hit = rule.keys.find((k) => src.includes(k))
    if (hit) keywordHits.push(`${hit}(+${rule.weight})`)
  }
  if (keywordHits.length) chunks.push(`关键词风险：${keywordHits.join('、')}`)

  const intScore = Math.round(Math.min(100, Math.max(0, Number(intensity) || 0)) * 0.28)
  chunks.push(`强度贡献：intensity=${Number(intensity) || 0} -> +${intScore}`)

  const pe = String(primaryEmotion || '')
  const peW = EMOTION_WEIGHT[pe] ?? 0
  if (peW) chunks.push(`主情绪贡献：${pe}(+${peW})`)

  const se = String(secondaryEmotion || '')
  const seW = SECONDARY_EMOTION_WEIGHT[se] ?? 0
  if (seW) chunks.push(`次情绪贡献：${se}(+${seW})`)

  const ct = String(contextType || 'general')
  const ctW = CONTEXT_WEIGHT[ct] ?? 0
  if (ctW) chunks.push(`情境贡献：${ct}(+${ctW})`)

  if (pe === 'unstable' && ct === 'self_negation') chunks.push('组合加权：unstable + self_negation (+12)')
  chunks.push(`最终分级：${riskLevel}（score=${riskScore}）`)
  return chunks.join('；')
}
