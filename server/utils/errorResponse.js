export const ERROR_CODE = {
  TIMEOUT: 'TIMEOUT',
  AI_ERROR: 'AI_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
}

/**
 * @param {unknown} err
 */
export function classifyError(err) {
  const msg = String(err && err.message ? err.message : err || '').toLowerCase()
  if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('timed out')) {
    return ERROR_CODE.TIMEOUT
  }
  if (msg.includes('invalid_json') || msg.includes('validation')) {
    return ERROR_CODE.VALIDATION_ERROR
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econn')) {
    return ERROR_CODE.NETWORK_ERROR
  }
  if (msg.includes('openai') || msg.includes('ai')) {
    return ERROR_CODE.AI_ERROR
  }
  return ERROR_CODE.INTERNAL_ERROR
}

/**
 * @param {import('express').Response} res
 * @param {string} code
 * @param {string} message
 * @param {number} status
 * @param {boolean} fallback
 */
export function sendError(res, code, message, status = 500, fallback = false) {
  return res.status(status).json({
    code,
    message,
    fallback,
  })
}
