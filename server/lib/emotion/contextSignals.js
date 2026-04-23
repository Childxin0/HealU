/**
 * 情境层：生活事件优先于纯情绪标签
 * 输出 contextType + keywordsMatched（从原文捕获的匹配片段）
 */

/** @typedef {{ contextType: string, keywordsMatched: string[], contextPriority: number }} ContextResult */

const RULES = [
  {
    contextType: 'breakup',
    priority: 1,
    describe: '分手/失恋/关系结束',
    patterns: [/分手(了)?|失恋|绝交|前任|分开了|不爱了|劈腿|拉黑|删好友|结束(?:了)?这段/],
  },
  {
    contextType: 'grief',
    priority: 2,
    describe: '丧亲/宠物离世/悼念',
    patterns: [
      /去世|离世|逝世|过世|不在了|丧|悼念|哀悼|忌日|头七|永别|阴阳两隔|安乐死/,
      /毛孩子|宠物去世|宠物离开|宠物走了|狗去世|猫去世|狗狗去世|猫咪去世|狗子走了|小猫走了/,
      /想念[^。，]{0,12}(奶奶|爷爷|外公|外婆|姥爷|姥姥|爸|妈|亲人)/,
      /(奶奶|爷爷|外公|外婆|姥爷|姥姥|亲人|家人)[^。，]{0,8}(去世|走了|离开|不在)/,
      /挚爱离开|最后一面|骨灰|墓碑|灵堂|送别/,
    ],
  },
  {
    contextType: 'family',
    priority: 3,
    describe: '家庭冲突',
    patterns: [/父母|爸妈|家里|家庭|吵架|亲戚|原生家庭|管控|唠叨/],
  },
  {
    contextType: 'body',
    priority: 4,
    describe: '身体不适',
    patterns: [/头疼|发烧|生病|身体|不舒服|胃痛|想吐|乏力|胸闷|晕|疼|失眠|睡不着|早醒/],
  },
  {
    contextType: 'study_stress',
    priority: 5,
    describe: '学业压力',
    patterns: [/考试|论文|学业|复习|成绩|挂科|作业|毕设|考研|课|学分/],
  },
  {
    contextType: 'work_stress',
    priority: 6,
    describe: '工作压力',
    patterns: [/工作|加班|老板|同事|项目|KPI|绩效|职场|客户|deadline|裁员/],
  },
  {
    contextType: 'loneliness',
    priority: 7,
    describe: '孤独',
    patterns: [/孤独|一个人|孤单|没人陪|独自|空荡荡/],
  },
  {
    contextType: 'neglect',
    priority: 8,
    describe: '被忽视',
    patterns: [/被忽视|没人理|冷落|不回消息|已读不回|当空气|不重要/],
  },
  {
    contextType: 'self_negation',
    priority: 9,
    describe: '自我否定',
    patterns: [/我不行|我很差|废物|配不上|讨厌自己|自我否定|一无是处|拖累/],
  },
]

function collectMatches(text, re) {
  const out = []
  const flags = re.flags.includes('g') ? re : new RegExp(re.source, 'g' + (re.flags || ''))
  let m
  const copy = String(text)
  while ((m = flags.exec(copy)) !== null) {
    if (m[0]) out.push(m[0])
    if (m.index === flags.lastIndex) flags.lastIndex++
  }
  return out
}

/**
 * @param {string} text
 * @returns {ContextResult}
 */
export function detectContext(text) {
  const raw = String(text || '').trim()
  const keywordsMatched = []
  let contextType = 'general'
  let contextPriority = 99

  for (const rule of RULES) {
    let hit = false
    for (const pat of rule.patterns) {
      if (pat.test(raw)) {
        hit = true
        const ms = collectMatches(raw, pat)
        for (const k of ms) {
          if (k && !keywordsMatched.includes(k)) keywordsMatched.push(k)
        }
      }
    }
    if (hit) {
      contextType = rule.contextType
      contextPriority = rule.priority
      break
    }
  }

  return { contextType, keywordsMatched, contextPriority }
}
