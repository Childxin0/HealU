/**
 * Insights 顶部一句总结：优先 OpenAI，失败则规则模板（可扩展）
 */

import OpenAI from 'openai'
import { all } from '../models/db.js'

const TIMEOUT_MS = 12000

/**
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function generateInsightSummary(userId) {
  const uid = String(userId || '').trim()
  const prof = all(`SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1`, [uid])[0]

  const dominant = prof?.dominant_emotion || 'reflective'
  const stress = Number(prof?.stress_level_avg || 0)
  const trend = stress >= 65 ? 'worsening' : stress <= 35 ? 'improving' : 'stable'
  const risk = prof?.risk_level || 'low'
  const breakupCount = Number(prof?.breakup_history_count || 0)
  const distHint = breakupCount > 0 ? `近阶段与关系议题相关记录 ${breakupCount} 次` : '数据在累积中'

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return templateSummary({ dominant, trend, risk, distHint })
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const system =
    '你是 HealU 产品文案：用一句中文（不超过 40 字）概括用户近期情绪画像，温暖克制，不诊断、不恐吓。只输出句子本身。'
  const user = [
    `dominantEmotion=${dominant}`,
    `stressLevelAvg=${stress}`,
    `recentTrend=${trend}`,
    `riskLevel=${risk}`,
    `breakupHistoryCount=${breakupCount}`,
  ].join('\n')

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        max_tokens: 80,
      },
      { signal: controller.signal }
    )
    clearTimeout(t)
    const out = completion.choices[0]?.message?.content?.trim()
    if (out) return out.slice(0, 120)
  } catch {
    clearTimeout(t)
  }

  return templateSummary({ dominant, trend, risk, distHint })
}

function templateSummary({ dominant, trend, risk, distHint }) {
  const trendZh =
    trend === 'improving' ? '略有缓和' : trend === 'worsening' ? '波动加重' : '相对稳定'
  const riskZh = risk === 'high' ? '风险偏高' : risk === 'medium' ? '需持续关注' : '风险可控'
  return `近阶段以「${dominant}」为主（${distHint}），整体${trendZh}，${riskZh}。`
}
