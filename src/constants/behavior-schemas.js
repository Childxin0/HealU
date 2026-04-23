// 预留：行为引导系统扩展结构（后续 Agent 阶段直接复用）
export const BEHAVIOR_MODULES = {
  prep: {
    tracks: ['科普', '依从性打卡', '复查提醒', 'LEN卫生经济学记录'],
    metrics: ['本周执行率', '漏服次数', '最近检测日期', '下次复查日期'],
  },
  growth: {
    tracks: ['每日健康打卡', '情绪记录', '复查提醒'],
    metrics: ['连续打卡天数', '情绪波动趋势', '提醒完成率'],
  },
}
