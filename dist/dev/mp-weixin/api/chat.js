"use strict";
const common_vendor = require("../common/vendor.js");
const config_index = require("../config/index.js");
const core_emotionEngine = require("../core/emotionEngine.js");
const core_storage = require("../core/storage.js");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const USER_KEY = "healu_server_user_id";
function getOrCreateUserId() {
  const existing = core_storage.storageGet(USER_KEY);
  if (existing != null && String(existing).trim() !== "") {
    return String(existing).trim();
  }
  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  core_storage.storageSet(USER_KEY, id);
  return id;
}
function postAnalyze(userId, text) {
  const url = config_index.resolveApiUrl("/api/analyze");
  return new Promise((resolve, reject) => {
    common_vendor.index.request({
      url,
      method: "POST",
      header: { "Content-Type": "application/json" },
      data: { userId, text },
      timeout: config_index.TIMEOUT,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(res.data && res.data.error || `HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(err)
    });
  });
}
async function requestChat({ inputText }) {
  const text = String(inputText || "").trim();
  const userId = getOrCreateUserId();
  try {
    const data = await postAnalyze(userId, text);
    console.log("[chat] /api/analyze ok", data && data.context, data && data.riskLevel);
    if (data && data.responseText) {
      return data.responseText;
    }
    await wait(200);
    return core_emotionEngine.process(text);
  } catch (e) {
    console.error("[chat] server failed, fallback local engine", e);
    await wait(200);
    return core_emotionEngine.process(text);
  }
}
exports.requestChat = requestChat;
