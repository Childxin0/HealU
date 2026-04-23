/**
 * 仅使用 uni 存储（H5/小程序一致）
 */

export function storageGet(key) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const v = uni.getStorageSync(key)
      if (v === '' || v === undefined) return null
      return v
    }
  } catch {
    /* ignore */
  }
  return null
}

export function storageSet(key, val) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, val)
    }
  } catch {
    /* ignore */
  }
}
