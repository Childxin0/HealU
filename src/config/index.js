const LOCAL_DEV_API = 'http://localhost:3000'
const DEFAULT_CLOUD_API = 'https://healu-xxx.run.tcloudbase.com'

const cleanBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '')
const toHttps = (url) => cleanBaseUrl(url).replace(/^http:\/\//i, 'https://')

const CLOUD_API_BASE_URL = cleanBaseUrl(import.meta.env.VITE_HEALU_CLOUD_URL || DEFAULT_CLOUD_API)
const H5_DEV_API_BASE_URL = cleanBaseUrl(import.meta.env.VITE_HEALU_SERVER_URL || LOCAL_DEV_API)

let isMpWeixin = false
// #ifdef MP-WEIXIN
isMpWeixin = true
// #endif

export const API_BASE_URL = isMpWeixin
  ? toHttps(CLOUD_API_BASE_URL)
  : import.meta.env.DEV
    ? H5_DEV_API_BASE_URL
    : CLOUD_API_BASE_URL

export const TIMEOUT = 30000

export const resolveApiUrl = (path) => {
  const normalizedPath = path && path.startsWith('/') ? path : `/${path || ''}`
  return `${API_BASE_URL}${normalizedPath}`
}