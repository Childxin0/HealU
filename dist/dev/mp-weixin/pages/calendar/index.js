"use strict";
const common_vendor = require("../../common/vendor.js");
const core_emotionEngine = require("../../core/emotionEngine.js");
const core_storage = require("../../core/storage.js");
const STORAGE_HISTORY = "healU_history";
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const list = common_vendor.ref([]);
    const detail = common_vendor.ref(null);
    function normalizeEntry(e) {
      if (!e || typeof e !== "object")
        return null;
      const primary = e.primaryEmotion || e.emotion || e.state || "reflective";
      return {
        ...e,
        primaryEmotion: primary,
        contextType: e.contextType || "general",
        tag: e.tag || "—",
        metaphor: e.metaphor || "—",
        empathyLine: e.empathyLine || "",
        summary: e.summary || `${primary} · ${e.tag || ""}`
      };
    }
    const normalized = common_vendor.computed(() => {
      const h = list.value;
      if (!Array.isArray(h))
        return [];
      return [...h].map(normalizeEntry).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
    });
    const spaceLabel = common_vendor.computed(() => {
      if (!detail.value)
        return "";
      const em = detail.value.primaryEmotion || detail.value.emotion || detail.value.state;
      const ctx = detail.value.contextType || "general";
      return core_emotionEngine.resolveSpaceName(em, ctx);
    });
    const LABEL_CN = {
      anxious: "焦虑张力",
      low_energy: "能量低",
      unstable: "波动明显",
      sad: "低落/失落",
      reflective: "觉察/沉淀",
      stable: "相对平稳"
    };
    function labelCn(id) {
      return LABEL_CN[id] || id || "—";
    }
    function load() {
      const h = core_storage.storageGet(STORAGE_HISTORY);
      list.value = Array.isArray(h) ? h : [];
    }
    common_vendor.onShow(() => {
      load();
    });
    function openDetail(item) {
      detail.value = item;
    }
    function closeDetail() {
      detail.value = null;
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: normalized.value.length
      }, normalized.value.length ? {
        b: common_vendor.f(normalized.value, (item, k0, i0) => {
          return {
            a: common_vendor.t(item.date),
            b: common_vendor.t(item.tag),
            c: common_vendor.t(item.metaphor),
            d: item.date + (item.tag || ""),
            e: common_vendor.o(($event) => openDetail(item), item.date + (item.tag || ""))
          };
        })
      } : {}, {
        c: detail.value
      }, detail.value ? common_vendor.e({
        d: common_vendor.t(detail.value.date),
        e: common_vendor.t(detail.value.tag),
        f: common_vendor.t(detail.value.metaphor),
        g: common_vendor.t(labelCn(detail.value.primaryEmotion || detail.value.emotion || detail.value.state)),
        h: common_vendor.t(spaceLabel.value),
        i: detail.value.empathyLine
      }, detail.value.empathyLine ? {
        j: common_vendor.t(detail.value.empathyLine)
      } : {}, {
        k: common_vendor.t(detail.value.summary || "—"),
        l: common_vendor.o(closeDetail, "32"),
        m: common_vendor.o(() => {
        }, "b1"),
        n: common_vendor.o(closeDetail, "28")
      }) : {});
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-03f4b073"]]);
wx.createPage(MiniProgramPage);
