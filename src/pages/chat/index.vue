<template>
  <view class="page">
    <view class="header">
      <view class="header-row">
        <view>
          <text class="brand">HealU</text>
          <text class="sub">情绪与状态</text>
        </view>
        <text class="link-cal" @tap="goCalendar">查看我的状态轨迹 →</text>
      </view>
    </view>

    <view v-if="bannerNoCheckin" class="card banner">
      <text class="banner-t">今日尚未在 HealU 留下状态</text>
    </view>
    <view v-if="bannerGap" class="card banner">
      <text class="banner-t">你好像有两天没来了，我们可以慢慢接上</text>
    </view>
    <view v-if="bannerDaily" class="card banner banner-accent">
      <text class="banner-t">今天要不要来看看自己的状态？</text>
    </view>

    <scroll-view
      v-if="messages.length"
      class="feed"
      scroll-y
      :scroll-into-view="scrollTargetId"
    >
      <view
        v-for="(msg, index) in messages"
        :key="index"
        :class="['bubble-wrap', msg.role]"
      >
        <view :id="`m-${index}`" :class="['bubble', msg.role, msg.emergency ? 'emergency' : '']">
          <view v-if="msg.role === 'ai' && msg.emergency" class="emergency-strip">
            {{ emergencyHead(msg.text) }}
          </view>
          <text class="bubble-text">{{ displayBody(msg) }}</text>
        </view>
      </view>
    </scroll-view>
    <view v-else class="feed-placeholder" />

    <view class="composer">
      <view v-if="loading" class="sending-hint">正在连接 HealU…</view>
      <view v-if="errorText" class="error-hint">{{ errorText }}</view>
      <view class="composer-row">
        <input
          v-model="userInput"
          class="input"
          placeholder="此刻的感受，一句话就够"
          :disabled="isSending"
          @confirm="send"
        />
        <button
          class="btn-send"
          plain
          :disabled="isSending"
          hover-class="btn-send-hover"
          @tap="send"
        >
          {{ isSending ? '…' : '发送' }}
        </button>
      </view>
      <button v-if="canRetry" class="btn-retry" plain @tap="retrySend">重试上次消息</button>
    </view>

    <view class="checkin-row">
      <button
        class="btn-checkin"
        plain
        :class="{ checked: checkinPressed }"
        hover-class="btn-checkin-hover"
        @tap="onCheckIn"
      >
        {{ checkinBtnLabel }}
      </button>
    </view>

    <view class="foot-note">非医疗诊断，严重不适请线下就医。</view>
  </view>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { requestChat } from '@/api/chat'
import { getDefaultCheckInSnapshot } from '@/core/emotionEngine'
import { storageGet, storageSet } from '@/core/storage.js'

const STORAGE_CHECKIN = 'healU_checkin'
const STORAGE_HISTORY = 'healU_history'
const STORAGE_LAST_EMOTION = 'healU_last_emotion'

const userInput = ref('')
const isSending = ref(false)
const loading = ref(false)
const error = ref(false)
const retry = ref(false)
const errorText = ref('')
const canRetry = ref(false)
const lastSentText = ref('')
const scrollTargetId = ref('')
const messages = ref([])

const bannerNoCheckin = ref(false)
const bannerGap = ref(false)
const bannerDaily = ref(false)

const checkinBtnLabel = ref('记录一下')
const checkinPressed = ref(false)

let dailyTimer = null
let checkinFlashTimer = null
let pageBootstrapped = false

function bootstrapPage() {
  if (pageBootstrapped) return
  try {
    evaluateBanners()
    scheduleDailyReminder()
  } catch (e) {
    console.error('[chat] bootstrap', e)
    if (typeof uni !== 'undefined' && uni.showToast) {
      uni.showToast({ title: '加载异常，可继续聊天', icon: 'none', duration: 2500 })
    }
  } finally {
    pageBootstrapped = true
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayBeforeYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readHistory() {
  const h = storageGet(STORAGE_HISTORY)
  return Array.isArray(h) ? h : []
}

function writeHistory(arr) {
  storageSet(STORAGE_HISTORY, arr.slice(-7))
}

function evaluateBanners() {
  const today = todayStr()
  const y = yesterdayStr()
  const dby = dayBeforeYesterdayStr()
  const checkin = storageGet(STORAGE_CHECKIN)
  const hist = readHistory()

  bannerNoCheckin.value = !(checkin && checkin.date === today)

  const hasTodayH = hist.some((e) => e.date === today)
  const hasYH = hist.some((e) => e.date === y)
  const sorted = [...hist].sort((a, b) => b.date.localeCompare(a.date))
  const last = sorted[0]
  bannerGap.value =
    hist.length > 0 &&
    !hasTodayH &&
    !hasYH &&
    last &&
    last.date <= dby

  const now = new Date()
  const h = now.getHours()
  const afterEight = h > 20 || (h === 20 && now.getMinutes() >= 0)
  bannerDaily.value = afterEight && !(checkin && checkin.date === today)
}

function scheduleDailyReminder() {
  if (dailyTimer) clearTimeout(dailyTimer)
  const now = new Date()
  const target = new Date()
  target.setHours(20, 0, 0, 0)
  if (now >= target) target.setDate(target.getDate() + 1)
  const ms = target.getTime() - now.getTime()
  dailyTimer = setTimeout(() => {
    const checkin = storageGet(STORAGE_CHECKIN)
    const t = todayStr()
    if (!checkin || checkin.date !== t) {
      bannerDaily.value = true
      if (typeof uni !== 'undefined' && uni.showToast) {
        uni.showToast({ title: '今天要不要来看看自己的状态？', icon: 'none', duration: 2800 })
      }
    }
    scheduleDailyReminder()
  }, ms)
}

onLoad(() => {
  bootstrapPage()
})

onMounted(() => {
  bootstrapPage()
})

onUnmounted(() => {
  if (dailyTimer) clearTimeout(dailyTimer)
  if (checkinFlashTimer) clearTimeout(checkinFlashTimer)
})

function goCalendar() {
  if (typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({ url: '/pages/calendar/index' })
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messages.value.length) {
    scrollTargetId.value = `m-${messages.value.length - 1}`
  }
}

const isEmergency = (text) => String(text || '').includes('【紧急提示】')

const emergencyHead = (text) => {
  const lines = String(text || '').split('\n')
  return lines[0] || ''
}

const displayBody = (msg) => {
  if (!msg.emergency) return msg.text
  return String(msg.text || '')
    .split('\n')
    .slice(1)
    .join('\n')
    .trim()
}

const send = async () => {
  const text = userInput.value.trim()
  if (!text || isSending.value) return

  messages.value.push({ role: 'user', text, emergency: false })
  lastSentText.value = text
  userInput.value = ''
  await scrollToBottom()

  loading.value = true
  isSending.value = true
  error.value = false
  retry.value = false
  errorText.value = ''
  canRetry.value = false
  let slowTimer = setTimeout(() => {
    errorText.value = '响应较慢，可重试'
    retry.value = true
  }, 10000)
  try {
    const reply = await requestChat({ inputText: text })
    const safeReply =
      reply != null && String(reply).trim() !== ''
        ? String(reply)
        : '稍后再试一次就好。'
    messages.value.push({
      role: 'ai',
      text: safeReply,
      emergency: isEmergency(safeReply),
    })
    try {
      evaluateBanners()
    } catch (err) {
      console.error('[chat] evaluateBanners', err)
    }
  } catch (e) {
    console.error(e)
    error.value = true
    retry.value = true
    errorText.value = '响应较慢，可重试'
    canRetry.value = true
    messages.value.push({
      role: 'ai',
      text: '网络不稳定，已为你保留输入内容，可再点发送。',
      emergency: false,
    })
    if (typeof uni !== 'undefined' && uni.showToast) {
      uni.showToast({ title: '请求未完成', icon: 'none', duration: 2000 })
    }
  } finally {
    clearTimeout(slowTimer)
    loading.value = false
    isSending.value = false
    await scrollToBottom()
  }
}

const retrySend = async () => {
  if (!lastSentText.value || isSending.value) return
  userInput.value = lastSentText.value
  canRetry.value = false
  await send()
}

const onCheckIn = () => {
  const today = todayStr()
  const existing = storageGet(STORAGE_CHECKIN)
  if (existing && existing.date === today) {
    if (typeof uni !== 'undefined' && uni.showToast) {
      uni.showToast({ title: '今天已经记录过了', icon: 'none' })
    }
    return
  }

  let snap = storageGet(STORAGE_LAST_EMOTION)
  const needDefault =
    !snap ||
    !snap.tag ||
    (!snap.primaryEmotion && !snap.state)
  if (needDefault) {
    const def = getDefaultCheckInSnapshot()
    snap = {
      primaryEmotion: def.primaryEmotion,
      secondaryEmotion: def.secondaryEmotion,
      contextType: def.contextType,
      keywordsMatched: def.keywordsMatched || [],
      tag: def.tag,
      metaphor: def.metaphor,
      empathyLine: def.empathyLine,
      summary: def.summary,
      space: def.spaceName,
      date: todayStr(),
    }
    storageSet(STORAGE_LAST_EMOTION, snap)
  } else if (!snap.primaryEmotion && snap.state) {
    snap = { ...snap, primaryEmotion: snap.state }
  }

  const pe = snap.primaryEmotion || snap.state || 'reflective'
  const entry = {
    date: today,
    emotion: pe,
    primaryEmotion: pe,
    secondaryEmotion: snap.secondaryEmotion || 'reflective',
    contextType: snap.contextType || 'general',
    keywordsMatched: Array.isArray(snap.keywordsMatched) ? snap.keywordsMatched : [],
    tag: snap.tag,
    metaphor: snap.metaphor || '—',
    empathyLine: snap.empathyLine || '',
    summary: snap.summary || `${pe} · ${snap.tag}`,
  }
  storageSet(STORAGE_CHECKIN, entry)
  const hist = readHistory()
  hist.push(entry)
  writeHistory(hist)

  if (typeof uni !== 'undefined' && uni.showToast) {
    uni.showToast({ title: '已帮你记下今天的状态', icon: 'none', duration: 2000 })
  }

  checkinBtnLabel.value = '已记录 ✓'
  checkinPressed.value = true
  if (checkinFlashTimer) clearTimeout(checkinFlashTimer)
  checkinFlashTimer = setTimeout(() => {
    checkinBtnLabel.value = '记录一下'
    checkinPressed.value = false
  }, 1500)

  evaluateBanners()
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f6f2;
  box-sizing: border-box;
}

.header {
  padding: 44rpx 32rpx 24rpx;
}

.header-row {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.brand {
  display: block;
  font-size: 44rpx;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: #1a1a1a;
}

.sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #999999;
}

.link-cal {
  font-size: 24rpx;
  color: #8c7a5b;
  padding: 8rpx 0;
}

.card {
  margin: 0 32rpx 24rpx;
  padding: 28rpx 32rpx;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  background: #ffffff;
}

.banner-accent {
  background: #ffffff;
  border-color: rgba(140, 122, 91, 0.2);
}

.banner-t {
  font-size: 26rpx;
  line-height: 1.55;
  color: #666666;
}

.feed {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 8rpx 32rpx 32rpx;
  overflow: auto;
}

.feed-placeholder {
  flex: 1;
  min-height: 80rpx;
}

.bubble-wrap {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 32rpx;
}

.bubble-wrap.user {
  justify-content: flex-end;
  padding-left: 72rpx;
}

.bubble {
  max-width: 70%;
  min-width: 0;
  padding: 32rpx 36rpx;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.bubble.ai {
  background: #ffffff;
}

.bubble.user {
  background: #ece8e1;
}

.bubble-text {
  font-size: 28rpx;
  line-height: 1.75;
  color: #1a1a1a;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble.user .bubble-text {
  color: #1a1a1a;
}

.bubble.emergency {
  border-color: rgba(180, 80, 80, 0.25);
}

.emergency-strip {
  font-size: 28rpx;
  font-weight: 600;
  color: #a33a3a;
  margin-bottom: 16rpx;
  padding: 20rpx 24rpx;
  background: #faf6f6;
  border-radius: 20rpx;
}

.composer {
  display: flex;
  flex-direction: column;
  padding: 16rpx 32rpx 24rpx;
  gap: 12rpx;
  background: #f8f6f2;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.sending-hint {
  font-size: 22rpx;
  color: #8c7a5b;
  padding: 0 4rpx;
}

.error-hint {
  font-size: 22rpx;
  color: #a33a3a;
  padding: 0 4rpx;
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
}

.input {
  flex: 1;
  height: 88rpx;
  padding: 0 32rpx;
  border-radius: 20rpx;
  background: #ffffff;
  font-size: 28rpx;
  color: #333333;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.btn-send {
  min-width: 120rpx;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 32rpx;
  border-radius: 20rpx;
  background: #1a1a1a;
  color: #f8f6f2;
  font-size: 28rpx;
  border: none;
}

.btn-send-hover {
  opacity: 0.92;
}

.btn-send[disabled] {
  opacity: 0.5;
}

.btn-retry {
  margin-top: 8rpx;
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #8c7a5b;
  border: 1px solid rgba(140, 122, 91, 0.35);
  background: #fff;
}

.checkin-row {
  padding: 12rpx 32rpx 32rpx;
}

.btn-checkin {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 20rpx;
  background: #ffffff;
  color: #1a1a1a;
  font-size: 28rpx;
  font-weight: 400;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease;
}

.btn-checkin.checked {
  color: #8c7a5b;
}

.btn-checkin-hover {
  transform: scale(0.97);
}

.foot-note {
  text-align: center;
  font-size: 20rpx;
  color: #999999;
  padding: 0 32rpx 32rpx;
}
</style>
