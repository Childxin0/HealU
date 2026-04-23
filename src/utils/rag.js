import { HEALTH_DOCS } from '@/kb/health-docs'

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:：()\[\]{}"'`~\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeDept = (text) =>
  String(text || '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\/\s]/g, '')
    .trim()

const tokenize = (text) => {
  const cleaned = normalize(text)
  if (!cleaned) return []
  const words = cleaned.split(' ').filter(Boolean)
  const chars = cleaned.replace(/\s+/g, '').split('')
  return [...new Set([...words, ...chars])]
}

const ALL_DOCS = HEALTH_DOCS.map((doc) => ({
  id: doc.id,
  title: doc.title,
  content: doc.content,
  department: doc.department,
  source: doc.source,
}))

const INTENT_KEYWORDS = {
  checkup: ['体检', '指标', '异常', '确诊', '复检', '报告'],
  prep: ['prep', 'hiv', '暴露前', '依从性', '漏服', '复查', '检测'],
  cardio: ['胸痛', '胸闷', '心慌', '心悸', '出冷汗', '猝死'],
  respiratory: ['咳', '喉', '发热', '鼻塞', '呼吸', '咽痛'],
  digestive: ['腹痛', '腹泻', '恶心', '呕吐', '便血', '黑便', '胃'],
  neuro: ['头痛', '头晕', '眩晕', '无力', '言语不清'],
  gyn: ['月经', '经期', '妇科', '分泌物', '痛经'],
  mental: ['焦虑', '失眠', '抑郁', '压力', '情绪', '轻生', '自伤'],
}

const DEPT_HINTS = {
  '全科/综合健康': ['全科', '综合', ...INTENT_KEYWORDS.checkup],
  '皮肤科': ['皮肤', '瘙痒', '皮疹', '痘', '过敏'],
  '呼吸内科': [...INTENT_KEYWORDS.respiratory],
  '消化内科': [...INTENT_KEYWORDS.digestive],
  '心血管内科': [...INTENT_KEYWORDS.cardio],
  '神经内科/头痛头晕': [...INTENT_KEYWORDS.neuro],
  '妇科/女性健康': [...INTENT_KEYWORDS.gyn],
  '心理健康/情绪压力': [...INTENT_KEYWORDS.mental],
  '健康防护中心': [...INTENT_KEYWORDS.prep],
  '健康防护中心(PrEP)': [...INTENT_KEYWORDS.prep],
}

const detectIntent = (query) => {
  const q = normalize(query)
  if (INTENT_KEYWORDS.prep.some((k) => q.includes(k))) return 'prep'
  if (INTENT_KEYWORDS.checkup.some((k) => q.includes(k))) return 'checkup'
  if (INTENT_KEYWORDS.cardio.some((k) => q.includes(k))) return 'cardio'
  if (INTENT_KEYWORDS.respiratory.some((k) => q.includes(k))) return 'respiratory'
  if (INTENT_KEYWORDS.digestive.some((k) => q.includes(k))) return 'digestive'
  if (INTENT_KEYWORDS.neuro.some((k) => q.includes(k))) return 'neuro'
  if (INTENT_KEYWORDS.gyn.some((k) => q.includes(k))) return 'gyn'
  if (INTENT_KEYWORDS.mental.some((k) => q.includes(k))) return 'mental'
  return 'general'
}

const scoreDoc = (queryTokens, doc, query) => {
  const text = normalize(`${doc.department} ${doc.title} ${doc.content}`)
  let score = 0
  for (const token of queryTokens) {
    if (!token) continue
    if (text.includes(token)) score += token.length >= 2 ? 3 : 1
  }
  const deptHints = DEPT_HINTS[doc.department] || []
  const q = normalize(query)
  for (const hint of deptHints) {
    if (q.includes(hint)) score += 2
  }
  return score
}

const similarity = (a, b) => {
  const ta = new Set(tokenize(a))
  const tb = new Set(tokenize(b))
  if (!ta.size || !tb.size) return 0
  let intersect = 0
  ta.forEach((t) => {
    if (tb.has(t)) intersect += 1
  })
  return intersect / Math.max(ta.size, tb.size)
}

const dedupeByContent = (docs, threshold = 0.85) => {
  const out = []
  for (const item of docs) {
    const duplicated = out.some((kept) => similarity(kept.content, item.content) > threshold)
    if (!duplicated) out.push(item)
  }
  return out
}

export function retrieveTopChunks(query, topK = 3, options = {}) {
  const preferredDepartment = String(options.preferredDepartment || '')
  const crossDepartmentThreshold = Number(options.crossDepartmentThreshold || 14)
  const queryTokens = tokenize(query)
  if (!queryTokens.length) return []

  const intent = detectIntent(query)
  const preferred = normalizeDept(preferredDepartment)

  const scored = ALL_DOCS
    .map((doc) => ({
      title: doc.title,
      content: doc.content,
      department: doc.department,
      score: scoreDoc(queryTokens, doc, query),
    }))
    .map((doc) => {
      const current = normalizeDept(doc.department)
      if (preferred && (current.includes(preferred) || preferred.includes(current))) {
        return { ...doc, score: doc.score + 6 }
      }
      return doc
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  // 1) 强约束 filter：优先当前科室为主来源
  if (preferred) {
    const strictDept = scored.filter((item) => {
      const current = normalizeDept(item.department)
      return current.includes(preferred) || preferred.includes(current)
    })
    if (strictDept.length > 0) return dedupeByContent(strictDept).slice(0, topK)

    // 仅当跨科室结果分数足够高时才允许降级使用
    const fallback = scored.filter((item) => item.score > crossDepartmentThreshold)
    return dedupeByContent(fallback).slice(0, topK)
  }

  // 2) 意图保护：减少跨科室污染
  if (intent === 'checkup') {
    const preferredDocs = scored.filter(
      (item) => item.department === '全科/综合健康' || item.title.includes('体检')
    )
    if (preferredDocs.length) return dedupeByContent(preferredDocs).slice(0, topK)
  }
  if (intent === 'prep') {
    const preferredDocs = scored.filter(
      (item) => item.department.includes('健康防护中心') || item.title.toLowerCase().includes('prep')
    )
    if (preferredDocs.length) return dedupeByContent(preferredDocs).slice(0, topK)
  }
  if (intent === 'mental') {
    const preferredDocs = scored.filter((item) => item.department.includes('心理健康'))
    if (preferredDocs.length) return dedupeByContent(preferredDocs).slice(0, topK)
  }

  return dedupeByContent(scored).slice(0, topK)
}
