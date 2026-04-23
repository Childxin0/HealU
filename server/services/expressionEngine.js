import crypto from 'crypto'

const RECENT_KEY = 'healU_recent_generated'
const HASH_POOL_KEY = 'healU_expression_hash_pool'

const userPools = new Map()

const empathyOpeners = [
  '你提到',
  '我听见你说',
  '你刚刚写到',
  '你反复在说',
  '你现在卡住的点像是',
  '你把这个场景描述得很清楚：',
  '你不是在“矫情”，你是在经历',
  '从你的描述里我看到',
  '你现在最难受的片段是',
  '你把那个瞬间讲出来了：',
]

const empathyEvents = [
  '关系结束后的空窗',
  '被忽视后的落差',
  '任务堆积的窒息感',
  '夜里反复想同一件事',
  '回到家后一下子泄气',
  '打开聊天框却不知道说什么',
  '看见消息已读却没回',
  '被比较后的自我否定',
  '身体紧绷又停不下来',
  '想求助又怕打扰别人',
]

const empathyImpacts = [
  '心会立刻往下沉',
  '胸口会像压着一块石头',
  '注意力会被不断拉走',
  '整个人像被抽空',
  '会开始怀疑自己是不是不够好',
  '会想把自己藏起来',
  '会一直复盘“是不是我做错了”',
  '会出现“撑不住了”的感觉',
  '会更难开口表达需求',
  '会对明天失去期待',
]

const metaphorsA = ['像潮水退掉后露出的礁石', '像夜里一直亮着的提示灯', '像没关掉的后台程序', '像绷得过紧的弦', '像结在喉咙口的线团']
const metaphorsB = ['每次触发都更刺一点', '一碰就会提醒你还在痛', '不处理会继续消耗电量', '需要先松一点才弹得回去', '慢慢理顺才能呼吸顺']

const microActs = ['把手放在胸口，慢慢吸气4秒、呼气6秒，做3轮', '喝一小口温水，只关注吞咽的感觉', '把脚掌压实地面10秒，再放松10秒，重复3次', '看向窗外一个固定点，稳定呼吸1分钟', '把肩膀抬起再放下，做5次']
const envActs = ['把手机消息提醒静音10分钟，给自己留出缓冲', '把灯光调暗一档，坐到更安静的位置', '离开当前座位走到门口再回来，打断反刍', '把房间里最乱的一小块桌面清理1分钟', '打开窗户或风扇，让空气流动起来']
const cogActs = ['写下一句“我现在最难的是___”，只写事实不评判', '把“我不行”改写成“我现在很难，但在尝试”', '把问题拆成下一步最小动作，只做第一步', '给当前情绪命名：委屈/害怕/疲惫，任选一个', '对自己说一句“我先稳定，再决定”']
const avoidActs = ['先别连刷聊天记录和社交动态', '先别在情绪最高点做关系决定', '先别用“全是我错”给自己定性', '先别熬夜硬扛任务', '先别把求助当成麻烦别人']

function expandTriples(a, b, c) {
  const out = []
  for (const x of a) {
    for (const y of b) {
      for (const z of c) {
        out.push(`${x}${y}，${z}。`)
      }
    }
  }
  return out
}

export const empathyFragments = expandTriples(empathyOpeners, empathyEvents, empathyImpacts) // 1000
export const metaphorFragments = expandTriples(metaphorsA, metaphorsB, ['你并不需要一下子解决全部', '先把自己放回可呼吸的节奏', '稳住此刻就已经很重要', '这不是软弱，是负荷过高', '先减少消耗再谈改变']) // 125
export const actionFragments = [...microActs, ...envActs, ...cogActs, ...microActs.map((x) => `现在就做：${x}`), ...envActs.map((x) => `环境上先这样：${x}`), ...cogActs.map((x) => `脑内先改成：${x}`)] // 30+

function getPool(uid) {
  if (!userPools.has(uid)) {
    userPools.set(uid, {
      [RECENT_KEY]: [],
      [HASH_POOL_KEY]: [],
    })
  }
  return userPools.get(uid)
}

function pick(arr, seed) {
  const i = Math.abs(seed) % arr.length
  return arr[i]
}

function hashOf(s) {
  return crypto.createHash('sha1').update(s).digest('hex')
}

function nextSeed(text, profile, turn = 0) {
  const base = `${text}|${JSON.stringify(profile || {})}|${Date.now()}|${turn}`
  return parseInt(hashOf(base).slice(0, 8), 16)
}

/**
 * @param {{ userId?: string, text: string, context?: string, profile?: Record<string, unknown> }} input
 */
export function generateDiverseExpression(input) {
  const uid = String(input.userId || 'anon')
  const pool = getPool(uid)
  const text = String(input.text || '')
  const profile = input.profile || {}

  let out = null
  for (let i = 0; i < 5; i++) {
    const seed = nextSeed(text, profile, i)
    const e = pick(empathyFragments, seed)
    const m = pick(metaphorFragments, seed >> 3)
    const micro = pick(microActs, seed >> 5)
    const environment = pick(envActs, seed >> 7)
    const cognitive = pick(cogActs, seed >> 9)
    const avoid = pick(avoidActs, seed >> 11)
    const signature = `${e}|${m}|${micro}|${environment}|${cognitive}|${avoid}`
    const h = hashOf(signature)
    if (!pool[HASH_POOL_KEY].includes(h)) {
      pool[HASH_POOL_KEY].push(h)
      pool[RECENT_KEY].push(signature)
      if (pool[HASH_POOL_KEY].length > 20) pool[HASH_POOL_KEY].shift()
      if (pool[RECENT_KEY].length > 10) pool[RECENT_KEY].shift()
      out = { empathy: `${e}\n${m}`, actions: { micro, environment, cognitive }, avoid }
      break
    }
  }

  if (!out) {
    out = {
      empathy: `${empathyOpeners[0]}${empathyEvents[0]}，${empathyImpacts[0]}。`,
      actions: { micro: microActs[0], environment: envActs[0], cognitive: cogActs[0] },
      avoid: avoidActs[0],
    }
  }

  return out
}
