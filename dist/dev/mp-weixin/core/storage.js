"use strict";
const common_vendor = require("../common/vendor.js");
function storageGet(key) {
  try {
    if (typeof common_vendor.index !== "undefined" && common_vendor.index.getStorageSync) {
      const v = common_vendor.index.getStorageSync(key);
      if (v === "" || v === void 0)
        return null;
      return v;
    }
  } catch {
  }
  return null;
}
function storageSet(key, val) {
  try {
    if (typeof common_vendor.index !== "undefined" && common_vendor.index.setStorageSync) {
      common_vendor.index.setStorageSync(key, val);
    }
  } catch {
  }
}
exports.storageGet = storageGet;
exports.storageSet = storageSet;
