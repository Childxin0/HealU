"use strict";
const common_vendor = require("../common/vendor.js");
const API_BASE_URL = "http://localhost:3000";
const TIMEOUT = 1e4;
const IS_MP = typeof common_vendor.index !== "undefined" && common_vendor.index.getSystemInfoSync().uniPlatform === "mp-weixin";
function resolveApiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (IS_MP) {
    const base = String(API_BASE_URL).replace(/\/$/, "");
    return `${base}${p}`;
  }
  return p;
}
exports.TIMEOUT = TIMEOUT;
exports.resolveApiUrl = resolveApiUrl;
