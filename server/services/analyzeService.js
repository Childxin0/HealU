import { analyzeEmotion } from '../lib/emotion/emotionAnalyzer.js'
import { resolveSpaceName, buildAnalyzeResult } from '../lib/emotion/emotionEngine.js'
import { generateTagAndMetaphor } from '../lib/emotion/contentGenerator.js'
import { analyzeEmotionWithAI } from './aiService.js'

/**
 * @param {string} text
 * @param {{
 *   history?: Array<{ emotion?: string, context?: string }>,
 *   profile?: Record<string, unknown>,
 * }} [options]
 */
export async function runAnalyze(text, options = {}) {
  const raw = String(text || '').trim()
  if (!raw) {
    return {
      primaryEmotion: 'reflective',
      secondaryEmotion: 'reflective',
      intensity: 0,
      contextType: 'general',
      responseText: '说说你现在的感觉吧，一句话也可以。',
      _aiMeta: metaLocal(0),
    }
  }

  const emergency = buildAnalyzeResult(raw)
  if (emergency.primaryEmotion === 'emergency') {
    return {
      primaryEmotion: 'emergency',
      secondaryEmotion: 'emergency',
      intensity: 100,
      contextType: 'general',
      responseText: emergency.responseText,
      _aiMeta: metaLocal(0),
    }
  }

  const local = analyzeEmotion(raw)
  const history = options.history || []
  const profile = options.profile || {}
  const usedProfile = Boolean(profile && Object.keys(profile).length)

  const ai = await analyzeEmotionWithAI({ text: raw, history, profile, userId: options.userId })

  const primaryEmotion = ai.emotion || local.primaryEmotion
  const secondaryEmotion = ai.secondaryEmotion || local.secondaryEmotion
  const contextType = ai.context || local.contextType
  const intensity = local.intensity

  const space = resolveSpaceName(primaryEmotion, contextType)
  const { tag } = generateTagAndMetaphor(primaryEmotion, contextType)

  const lines = [
    `你现在在：\nHealU · ${space}`,
    '',
    `你现在更像是：\n「${tag}」`,
    '',
    ai.empathy,
    '',
    '🧭 给你的当前落点',
    ...ai.suggestions.map((s) => `- ${s}`),
    '',
    '🚧 先别往这边走',
    `- ${ai.avoid || '先别在情绪最满的时候做重大决定'}`,
    '',
    '📝 留个小标记',
    '- 点「记录一下」，沉淀今天的状态',
  ]
  const responseText = lines.join('\n')
  const personalizationScore = computePersonalizationScore({ history, profile, ai })

  return {
    primaryEmotion,
    secondaryEmotion,
    intensity,
    contextType,
    responseText,
    personalizationScore,
    usedProfile,
    _aiMeta: {
      aiSource: ai.meta?.aiSource || 'local',
      latencyMs: ai.meta?.latencyMs ?? 0,
      latency: ai.meta?.latencyMs ?? 0,
      fallback: Boolean(ai.meta?.fallback),
      fallbackReason: ai.meta?.fallbackReason || '',
      rawAi: ai.rawAi,
    },
  }
}

function metaLocal(ms) {
  return { aiSource: 'local', latencyMs: ms, latency: ms, fallback: false, fallbackReason: '' }
}

function computePersonalizationScore({ history, profile, ai }) {
  let score = 0.2
  if (Array.isArray(history) && history.length) score += 0.2
  if (profile && Object.keys(profile).length) score += 0.25
  if (String(ai?.empathy || '').includes('你提到')) score += 0.15
  if (Array.isArray(ai?.actions) && ai.actions.length >= 3) score += 0.2
  return Math.min(1, Math.max(0, Number(score.toFixed(3))))
}
