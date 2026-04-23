/**
 * 可演进语义规则表（非「关键词字典」形态）
 * 每条为：可测试片段 / 句式 / 语义权重 → 向多情绪维度累加
 * 新增规则：往数组 push 即可，无需改核心引擎
 */

/** @typedef {{ anxious?: number, low_energy?: number, unstable?: number, sad?: number, reflective?: number }} EmotionWeights */

/**
 * @type {Array<{ id: string, describe: string, test: (t: string) => boolean, add: EmotionWeights }>}
 */
export const EMOTION_SEMANTIC_RULES = [
  {
    id: 'grief-death-missing',
    describe: '丧亲、宠物离世、悼念与想念',
    test: (t) =>
      /去世|离世|过世|悼念|毛孩子|宠物去世|宠物离开|狗去世|猫去世|永别|阴阳两隔|丧礼|哀思/.test(t) ||
      /想念.{0,16}(奶奶|爷爷|外公|外婆|姥爷|姥姥)/.test(t) ||
      /(奶奶|爷爷|外公|外婆|姥爷|姥姥).{0,12}(去世|走了|离开|不在)/.test(t),
    add: { sad: 22, reflective: 10, low_energy: 8, anxious: 4 },
  },
  {
    id: 'worry-future',
    describe: '对未来的担忧',
    test: (t) => /担心|焦虑|不安|忐忑|心里没底|怕出事/.test(t),
    add: { anxious: 14, sad: 2 },
  },
  {
    id: 'overthink',
    describe: '反刍与过度思考',
    test: (t) => /想太多|停不下来|反复想|睡不着|脑子转|一直想/.test(t),
    add: { anxious: 16, low_energy: 4 },
  },
  {
    id: 'pressure',
    describe: '压力与任务负荷',
    test: (t) => /压力|喘不过气|任务多| deadline|加班|赶不完/.test(t),
    add: { anxious: 12, low_energy: 8 },
  },
  {
    id: 'fatigue-body',
    describe: '躯体疲惫',
    test: (t) => /好累|疲惫|没劲|提不起|不想动|瘫|虚/.test(t),
    add: { low_energy: 18, sad: 4 },
  },
  {
    id: 'procrastination',
    describe: '拖延与启动困难',
    test: (t) => /拖延|不想做|起不来|拖着|一动不想/.test(t),
    add: { low_energy: 16, anxious: 6 },
  },
  {
    id: 'irritable',
    describe: '易怒与烦躁',
    test: (t) => /烦|暴躁|火大|受不了|一点就炸|想骂人/.test(t),
    add: { unstable: 18, anxious: 6 },
  },
  {
    id: 'collapse',
    describe: '崩溃感',
    test: (t) => /崩溃|撑不住|要炸了|扛不住|撑不下去了/.test(t),
    add: { unstable: 20, sad: 8, low_energy: 6 },
  },
  {
    id: 'sad-loss',
    describe: '失落与难过',
    test: (t) => /难过|难受|伤心|委屈|想哭|失落|空落落的/.test(t),
    add: { sad: 18, low_energy: 6 },
  },
  {
    id: 'relationship-hurt',
    describe: '关系受伤',
    test: (t) => /分手|绝交|冷战|不理我|被冷落|背叛|对不起我/.test(t),
    add: { sad: 16, unstable: 10, anxious: 6 },
  },
  {
    id: 'lonely',
    describe: '孤独',
    test: (t) => /孤独|一个人|没人懂|被忽略|没人在乎/.test(t),
    add: { sad: 12, anxious: 8, reflective: 4 },
  },
  {
    id: 'self-blame',
    describe: '自责',
    test: (t) => /我不行|我很差|都怪我|废物|对不起/.test(t),
    add: { sad: 14, low_energy: 8, anxious: 6 },
  },
  {
    id: 'sentence-dont-want',
    describe: '句式：我不想…',
    test: (t) => /我不想(?:再)?|我不愿意|我不要/.test(t),
    add: { low_energy: 10, unstable: 6 },
  },
  {
    id: 'sentence-seems',
    describe: '句式：我好像…',
    test: (t) => /我好像|我感觉我|我是不是/.test(t),
    add: { anxious: 8, reflective: 6 },
  },
  {
    id: 'sentence-really',
    describe: '句式：我真的…',
    test: (t) => /我真的(?:很|特别|好|快)?/.test(t),
    add: { unstable: 6, sad: 6, anxious: 6 },
  },
  {
    id: 'mixed-tired-sad',
    describe: '又累又难过（混合）',
    test: (t) => /又累又|又烦又|又气又|既.*又/.test(t),
    add: { low_energy: 10, sad: 10, unstable: 6 },
  },
  {
    id: 'duration-chronic',
    describe: '长期化叙述',
    test: (t) => /一直|每天|最近总是|好久|持续|从来都/.test(t),
    add: { anxious: 8, low_energy: 8, sad: 4 },
  },
  {
    id: 'insomnia',
    describe: '睡眠问题',
    test: (t) => /失眠|睡不着|早醒|多梦|熬夜/.test(t),
    add: { anxious: 12, low_energy: 10 },
  },
  {
    id: 'work-burnout',
    describe: '工作场景耗竭',
    test: (t) => /上班|工作|老板|同事|项目| KPI| 绩效/.test(t),
    add: { low_energy: 8, anxious: 8, unstable: 4 },
  },
  {
    id: 'calm-positive',
    describe: '平稳或正向',
    test: (t) => /还行|还好|不错|平静|放松|好一点|稳定/.test(t),
    add: { reflective: 12, anxious: -4 },
  },
]

/** 句式放大器：匹配则给主导情绪额外加权 */
export const PATTERN_MULTIPLIERS = [
  {
    id: 'negation-chain',
    test: (t) => /不知道.{0,6}(怎么办|如何)/.test(t),
    boost: { anxious: 10 },
  },
  {
    id: 'question-doubt',
    test: (t) => /为什么是我|凭什么|怎么会这样/.test(t),
    boost: { sad: 8, unstable: 8 },
  },
]
