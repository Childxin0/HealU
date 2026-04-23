/**
 * 风险引擎：可扩展规则，输出 0–100 分与 low / medium / high / critical
 */

/** @typedef {{ id: string, weight: number, test: (ctx: RiskContext) => boolean }} RiskRule */

/**
 * @typedef {{
 *   text: string,
 *   intensity: number,
 *   primaryEmotion: string,
 *   secondaryEmotion?: string,
 *   contextType: string,
 * }} RiskContext
 */

/** 次要情绪叠加（可扩展 id） */
export const SECONDARY_EMOTION_WEIGHT = {
  sad: 8,
  unstable: 6,
  anxious: 4,
  low_energy: 2,
  reflective: 0,
}

/** 可新增关键词或权重（自杀类须单独能推到 ≥70 以触发熔断） */
export const KEYWORD_RULES = [
  { keys: ['自杀', '不想活', '结束生命', '去死'], weight: 72 },
  { keys: ['自残', '割腕', '伤害自己'], weight: 55 },
  { keys: ['胸痛', '呼吸困难', '出冷汗'], weight: 38 },
]
export const CRITICAL_TRIGGERS = ['不想活了', '想死', '结束自己']

/** 情绪维度（可扩展 emotion id） */
export const EMOTION_WEIGHT = {
  unstable: 18,
  sad: 12,
  anxious: 10,
  low_energy: 8,
  reflective: 0,
}

/** 情境维度 */
export const CONTEXT_WEIGHT = {
  self_negation: 18,
  body: 14,
  grief: 10,
  general: 0,
}

/**
 * @param {RiskContext} ctx
 * @returns {{ riskScore: number, riskLevel: 'low'|'medium'|'high'|'critical' }}
 */
export function computeRisk(ctx) {
  const text = String(ctx.text || '')
  if (CRITICAL_TRIGGERS.some((k) => text.includes(k))) {
    return { riskScore: 100, riskLevel: 'critical' }
  }
  let score = 0

  for (const rule of KEYWORD_RULES) {
    for (const k of rule.keys) {
      if (text.includes(k)) {
        score += rule.weight
        break
      }
    }
  }

  const int = Math.min(100, Math.max(0, Number(ctx.intensity) || 0))
  score += Math.round(int * 0.28)

  const pe = String(ctx.primaryEmotion || '')
  score += EMOTION_WEIGHT[pe] ?? 0

  const se = String(ctx.secondaryEmotion || '')
  score += SECONDARY_EMOTION_WEIGHT[se] ?? 0

  const ct = String(ctx.contextType || 'general')
  score += CONTEXT_WEIGHT[ct] ?? 0

  if (pe === 'unstable' && ct === 'self_negation') {
    score += 12
  }

  score = Math.min(100, Math.max(0, score))

  let riskLevel = /** @type {'low'|'medium'|'high'|'critical'} */ ('low')
  if (score >= 85) riskLevel = 'critical'
  else if (score >= 70) riskLevel = 'high'
  else if (score >= 40) riskLevel = 'medium'

  return { riskScore: score, riskLevel }
}

export function isHighRisk(level) {
  return level === 'high' || level === 'critical'
}

export function isCriticalRisk(level) {
  return level === 'critical'
}
