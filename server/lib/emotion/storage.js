/**
 * 服务端内存存储（替代 uni），供生成去重与引擎状态使用
 */

const store = new Map()

export function storageGet(key) {
  const v = store.get(key)
  if (v === '' || v === undefined) return null
  return v
}

export function storageSet(key, val) {
  store.set(key, val)
}
