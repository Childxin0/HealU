/** @typedef {{ emotion?: string, context?: string }} HistoryItem */

export function buildSystemRole() {
  return [
    '你是 HealU 的心理支持型 AI。',
    '你的目标：识别情绪与情境，复述具体事件，给出可执行的1分钟动作。',
    '你不是治疗师，不做诊断与处方；涉及危险内容仅给安全建议。',
  ].join('\n')
}

export function buildHistoryContextBlock(history) {
  if (!Array.isArray(history) || history.length === 0) return '最近无记录。'
  return history
    .map((h, i) => `${i + 1}) emotion=${h.emotion || 'unknown'}; context=${h.context || 'general'}`)
    .join('\n')
}

export function buildCurrentInputBlock(text) {
  return `用户原话：${String(text || '').trim().slice(0, 6000)}`
}

export function buildProfileBlock(profile) {
  const p = profile && typeof profile === 'object' ? profile : {}
  const lines = [
    `dominantEmotion=${p.dominantEmotion || 'unknown'}`,
    `stressLevelAvg=${Number(p.stressLevelAvg || 0)}`,
    `breakupHistoryCount=${Number(p.breakupHistoryCount || 0)}`,
    `negativeBiasScore=${Number(p.negativeBiasScore || 0)}`,
    `riskLevel=${p.riskLevel || 'low'}`,
  ]
  if (Number(p.stressLevelAvg || 0) >= 60 || Number(p.negativeBiasScore || 0) >= 6) {
    lines.push('解释提示：用户近期多次表现出高压力和负面情绪倾向。')
  }
  return lines.join('\n')
}

export function buildReasoningConstraintLayer() {
  return [
    '约束1：必须识别具体情境（例如 breakup / work_stress / loneliness 等）。',
    '约束2：必须复述用户提到的具体事件，不得抽象化，不得只说“这很正常”。',
    '约束3：empathy 要包含事件线索（如“关系结束”“被忽视”“任务压顶”）。',
    '约束4：actions 必须提供3个不同类型动作（micro/environment/cognitive），每个1分钟内可执行。',
    '约束5：avoid 给出当前应避免的一件事，必须具体。',
  ].join('\n')
}

export function buildOutputInstruction() {
  return [
    '只输出 JSON 对象，不要 markdown：',
    '{',
    '  "emotion": "anxious|low_energy|unstable|sad|reflective",',
    '  "secondaryEmotion": "anxious|low_energy|unstable|sad|reflective",',
    '  "context": "general|breakup|grief|family|body|study_stress|work_stress|loneliness|neglect|self_negation",',
    '  "empathy": "2-4句中文，必须带用户事件细节",',
    '  "actions": [',
    '    { "type": "micro", "text": "..." },',
    '    { "type": "environment", "text": "..." },',
    '    { "type": "cognitive", "text": "..." }',
    '  ],',
    '  "avoid": "一句避免项",',
    '  "tone": "warm|grounded|urgent"',
    '}',
  ].join('\n')
}

export function assembleUserLayers(layers) {
  return [
    '【Context: 当前输入】',
    layers.inputBlock,
    '',
    '【Context: 最近3条history】',
    layers.historyBlock,
    '',
    '【Context: 用户画像profile】',
    layers.profileBlock,
    '',
    '【Reasoning约束】',
    layers.reasoningBlock,
    '',
    '【Output格式】',
    layers.instructionBlock,
  ].join('\n')
}

export function buildPrompt({ text, history, profile }) {
  const system = buildSystemRole()
  const user = assembleUserLayers({
    inputBlock: buildCurrentInputBlock(text),
    historyBlock: buildHistoryContextBlock(history),
    profileBlock: buildProfileBlock(profile),
    reasoningBlock: buildReasoningConstraintLayer(),
    instructionBlock: buildOutputInstruction(),
  })
  return { system, user }
}
