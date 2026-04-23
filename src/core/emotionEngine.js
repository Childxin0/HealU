/**
 * HealU · Emotion Engine：情境优先 + 动态空间 + 缓冲动作 + 同步生成
 */

import { analyzeEmotion } from './emotionAnalyzer.js'
import { buildEmpathyLine } from './empathyBuilder.js'
import { generateBufferingActions, generateAvoidLine } from './actionGenerator.js'
import { generateTagAndMetaphor } from './contentGenerator.js'
import { storageGet, storageSet } from './storage.js'

const STORAGE_CHECKIN = 'healU_checkin'
const STORAGE_HISTORY = 'healU_history'
const STORAGE_LAST_EMOTION = 'healU_last_emotion'

const MEDICAL_RED = ['胸痛', '呼吸困难', '出冷汗']

const SPACE_EMOTION = {
  anxious: '想太多回旋走廊',
  low_energy: '缓慢降速区',
  unstable: '情绪波动带',
  sad: '低饱和度回廊',
  reflective: '留白观察厅',
  stable: '平稳运行区',
}

/** 情境优先的动态空间（contextType !== general 时覆盖纯情绪空间） */
const SPACE_CONTEXT = {
  breakup: '关系收束回廊',
  grief: '告别与思念厅',
  family: '家庭张力厅',
  body: '身体信号区',
  study_stress: '学业挤压带',
  work_stress: '任务回旋区',
  loneliness: '独处回声廊',
  neglect: '被看见的缺口',
  self_negation: '自我苛责坑道',
}

/**
 * @param {string} primaryEmotion
 * @param {string} contextType
 */
export function resolveSpaceName(primaryEmotion, contextType) {
  if (contextType && contextType !== 'general' && SPACE_CONTEXT[contextType]) {
    return SPACE_CONTEXT[contextType]
  }
  return SPACE_EMOTION[primaryEmotion] || SPACE_EMOTION.reflective
}

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readHistory() {
  const h = storageGet(STORAGE_HISTORY)
  return Array.isArray(h) ? h : []
}

function writeLastEmotion(payload) {
  storageSet(STORAGE_LAST_EMOTION, payload)
}

function yesterdayBanner() {
  const hist = readHistory()
  const yd = yesterdayStr()
  const hit = hist.find((h) => h.date === yd)
  if (!hit) return ''
  const emo = hit.primaryEmotion || hit.emotion || hit.state || 'reflective'
  const ctx = hit.contextType || 'general'
  const space = resolveSpaceName(emo, ctx)
  return `你昨天在：\nHealU · ${space}\n\n今天感觉有变化吗？\n\n`
}

/**
 * 无对话打卡默认
 */
export function getDefaultCheckInSnapshot() {
  const { tag, metaphor } = generateTagAndMetaphor('reflective', 'general')
  const empathyLine = buildEmpathyLine('', 'reflective', 'general', [])
  return {
    primaryEmotion: 'reflective',
    secondaryEmotion: 'stable',
    contextType: 'general',
    keywordsMatched: [],
    spaceName: resolveSpaceName('reflective', 'general'),
    tag,
    metaphor,
    empathyLine,
    summary: '今天在 HealU 留了一个平静锚点',
  }
}

/**
 * @param {string} stateOrEmotion
 */
export function getSpaceNameByState(stateOrEmotion) {
  return SPACE_EMOTION[stateOrEmotion] || SPACE_EMOTION.reflective
}

/**
 * @param {string} userInput
 * @returns {string}
 */
export function process(userInput) {
  const raw = String(userInput || '').trim()

  if (MEDICAL_RED.some((w) => raw.includes(w))) {
    writeLastEmotion(null)
    return '【紧急提示】\n请立即就医或联系急救服务'
  }

  if (!raw) {
    return '说说你现在的感觉吧，一句话也可以。'
  }

  const analysis = analyzeEmotion(raw)
  const {
    primaryEmotion,
    secondaryEmotion,
    intensity,
    confidence,
    contextType,
    keywordsMatched,
  } = analysis

  const space = resolveSpaceName(primaryEmotion, contextType)
  const { tag, metaphor } = generateTagAndMetaphor(primaryEmotion, contextType)
  const [actMicro, actEnv, actCog] = generateBufferingActions(contextType, primaryEmotion)
  const avoid = generateAvoidLine(contextType, primaryEmotion)
  const empathy = buildEmpathyLine(raw, primaryEmotion, contextType, keywordsMatched)
  const summary = `「${tag}」· ${space}`

  const payload = {
    date: todayStr(),
    primaryEmotion,
    secondaryEmotion,
    intensity,
    confidence,
    contextType,
    keywordsMatched,
    tag,
    metaphor,
    summary,
    empathyLine: empathy,
    space,
    analysis,
  }
  writeLastEmotion(payload)

  const prefix = yesterdayBanner()
  const body = [
    `你现在在：\nHealU · ${space}`,
    '',
    `你现在更像是：\n「${tag}」`,
    '',
    empathy,
    '',
    '🧭 给你的当前落点',
    `- ${actMicro}`,
    `- ${actEnv}`,
    `- ${actCog}`,
    '',
    '🚧 先别往这边走',
    `- ${avoid}`,
    '',
    '📝 留个小标记',
    '- 点「记录一下」，沉淀今天的状态',
  ].join('\n')

  return prefix + body
}
