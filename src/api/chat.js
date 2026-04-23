import { resolveApiUrl, TIMEOUT } from '@/config/index.js'
import { process as emotionProcess } from '@/core/emotionEngine'
import { storageGet, storageSet } from '@/core/storage.js'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const USER_KEY = 'healu_server_user_id'

function getOrCreateUserId() {
  const existing = storageGet(USER_KEY)
  if (existing != null && String(existing).trim() !== '') {
    return String(existing).trim()
  }
  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  storageSet(USER_KEY, id)
  return id
}

function postAnalyze(userId, text) {
  const url = resolveApiUrl('/api/analyze')
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { userId, text },
      timeout: TIMEOUT,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error((res.data && res.data.error) || `HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function requestChat({ inputText }) {
  const text = String(inputText || '').trim()
  const userId = getOrCreateUserId()

  try {
    const data = await postAnalyze(userId, text)
    console.log('[chat] /api/analyze ok', data && data.context, data && data.riskLevel)
    if (data && data.responseText) {
      return data.responseText
    }
    await wait(200)
    return emotionProcess(text)
  } catch (e) {
    console.error('[chat] server failed, fallback local engine', e)
    await wait(200)
    return emotionProcess(text)
  }
}
