/**
 * AI 调用：超时 + 回退 + 统一 meta（aiSource / latency / fallback）
 */

import OpenAI from 'openai'
import { buildAnalyzeResult } from '../lib/emotion/emotionEngine.js'
import { buildPrompt } from './promptBuilder.js'
import { generateDiverseExpression } from './expressionEngine.js'

const ENUM_E = ['anxious', 'low_energy', 'unstable', 'sad', 'reflective']
const ENUM_C = ['general', 'breakup', 'grief', 'family', 'body', 'study_stress', 'work_stress', 'loneliness', 'neglect', 'self_negation']
const TEMPLATE_PATTERNS = ['这是正常的', '你并不孤单', '慢慢来', '要相信自己']
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 25000

export async function analyzeEmotionWithAI(input) {
  const text = String(input?.text || '').trim()
  const history = Array.isArray(input?.history) ? input.history : []
  const profile = input?.profile && typeof input.profile === 'object' ? input.profile : {}
  const userId = String(input?.userId || '')

  const tStart = Date.now()
  const base = structureFromLocalEngine(text, userId, profile)
  const { system, user } = buildPrompt({ text, history, profile })
  console.log('[aiService] prompt.system:', system)
  console.log('[aiService] prompt.user:', user)
  const baseOut = {
    emotion: base.emotion,
    secondaryEmotion: base.secondary_emotion,
    context: base.context,
    empathy: base.empathy,
    suggestions: base.suggestions,
    actions: base.actions,
    avoid: base.avoid,
    tone: 'grounded',
    meta: {
      aiSource: 'local',
      latencyMs: Date.now() - tStart,
      latency: Date.now() - tStart,
      fallback: false,
      fallbackReason: '',
    },
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.log('[aiService] ai.raw:', 'N/A (local-only)')
    console.log('[aiService] fallback.reason:', 'NO_API_KEY')
    baseOut.meta.fallbackReason = 'NO_API_KEY'
    return baseOut
  }

  const client = new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const tApi = Date.now()

  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.7,
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const raw = completion.choices[0]?.message?.content || '{}'
    console.log('[aiService] ai.raw:', raw)
    const merged = mergeAiWithBase(JSON.parse(raw), base)
    const validation = validateAIOutput(merged, text)
    if (!validation.ok) {
      console.log('[aiService] fallback.reason:', validation.reason)
      return {
        ...baseOut,
        meta: {
          aiSource: 'local',
          latencyMs: Date.now() - tApi,
          latency: Date.now() - tApi,
          fallback: true,
          fallbackReason: validation.reason,
        },
      }
    }
    return {
      ...merged,
      meta: {
        aiSource: 'openai',
        latencyMs: Date.now() - tApi,
        latency: Date.now() - tApi,
        fallback: false,
        fallbackReason: '',
      },
      rawAi: raw,
    }
  } catch (e) {
    clearTimeout(timer)
    const reason = e?.name === 'AbortError' ? 'TIMEOUT' : 'AI_ERROR'
    console.log('[aiService] fallback.reason:', reason)
    return {
      ...baseOut,
      meta: {
        aiSource: 'local',
        latencyMs: Date.now() - tApi,
        latency: Date.now() - tApi,
        fallback: true,
        fallbackReason: reason,
      },
    }
  }
}

function mergeAiWithBase(j, base) {
  const emotion = pickEnum(j.emotion, ENUM_E, base.emotion)
  let secondaryEmotion = pickEnum(j.secondaryEmotion ?? j.secondary_emotion, ENUM_E, base.secondary_emotion)
  if (secondaryEmotion === emotion) secondaryEmotion = otherEmotion(emotion)
  const context = pickEnum(j.context, ENUM_C, base.context)
  const empathy = String(j.empathy || '').trim() || base.empathy
  const actions = normalizeActions(j.actions, base.actions)
  return {
    emotion,
    secondaryEmotion,
    context,
    empathy,
    suggestions: actions.map((x) => x.text),
    actions,
    avoid: String(j.avoid || '').trim() || base.avoid,
    tone: String(j.tone || '').trim() || 'grounded',
  }
}

function normalizeActions(actionsRaw, fallback) {
  const actions = Array.isArray(actionsRaw)
    ? actionsRaw
        .map((a) => ({ type: String(a?.type || '').trim().toLowerCase(), text: String(a?.text || '').trim() }))
        .filter((a) => a.text)
    : []
  if (actions.length >= 3) return actions.slice(0, 3)
  return fallback
}

export function validateAIOutput(result, text) {
  const keys = extractSemanticKeywords(text)
  const empathy = String(result?.empathy || '')
  if (keys.length && !keys.some((k) => empathy.includes(k))) return { ok: false, reason: 'VALIDATION_EMPATHY_NOT_GROUNDED' }
  const actions = Array.isArray(result?.actions) ? result.actions : []
  if (actions.length < 3) return { ok: false, reason: 'VALIDATION_ACTIONS_INSUFFICIENT' }
  const types = new Set(actions.map((x) => x.type))
  if (!types.has('micro') || !types.has('environment') || !types.has('cognitive')) return { ok: false, reason: 'VALIDATION_ACTION_TYPES' }
  if (TEMPLATE_PATTERNS.some((p) => empathy.includes(p))) return { ok: false, reason: 'VALIDATION_TEMPLATE_SENTENCE' }
  return { ok: true, reason: '' }
}

function extractSemanticKeywords(text) {
  const clean = String(text || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
  const tokens = clean.split(/\s+/).filter(Boolean)
  return Array.from(new Set(tokens.filter((x) => x.length >= 2))).slice(0, 6)
}

function pickEnum(v, allowed, fallback) {
  const s = String(v ?? '').trim().toLowerCase()
  return allowed.includes(s) ? s : fallback
}

function otherEmotion(em) {
  return ENUM_E.find((x) => x !== em) || 'reflective'
}

function structureFromLocalEngine(text, userId, profile) {
  const r = buildAnalyzeResult(text)
  const diverse = generateDiverseExpression({ userId, text, context: r.contextType, profile })
  const actions = [
    { type: 'micro', text: diverse.actions.micro },
    { type: 'environment', text: diverse.actions.environment },
    { type: 'cognitive', text: diverse.actions.cognitive },
  ]
  return {
    emotion: r.primaryEmotion === 'emergency' ? 'sad' : r.primaryEmotion,
    secondary_emotion: r.secondaryEmotion === 'emergency' ? 'anxious' : r.secondaryEmotion,
    context: r.contextType || 'general',
    empathy: diverse.empathy,
    suggestions: actions.map((x) => x.text),
    actions,
    avoid: diverse.avoid,
  }
}
