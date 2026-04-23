"use strict";
const common_vendor = require("../../common/vendor.js");
const api_chat = require("../../api/chat.js");
const core_emotionEngine = require("../../core/emotionEngine.js");
const core_storage = require("../../core/storage.js");
const STORAGE_CHECKIN = "healU_checkin";
const STORAGE_HISTORY = "healU_history";
const STORAGE_LAST_EMOTION = "healU_last_emotion";
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const userInput = common_vendor.ref("");
    const isSending = common_vendor.ref(false);
    const loading = common_vendor.ref(false);
    const error = common_vendor.ref(false);
    const retry = common_vendor.ref(false);
    const errorText = common_vendor.ref("");
    const canRetry = common_vendor.ref(false);
    const lastSentText = common_vendor.ref("");
    const scrollTargetId = common_vendor.ref("");
    const messages = common_vendor.ref([]);
    const bannerNoCheckin = common_vendor.ref(false);
    const bannerGap = common_vendor.ref(false);
    const bannerDaily = common_vendor.ref(false);
    const checkinBtnLabel = common_vendor.ref("记录一下");
    const checkinPressed = common_vendor.ref(false);
    let dailyTimer = null;
    let checkinFlashTimer = null;
    let pageBootstrapped = false;
    function bootstrapPage() {
      if (pageBootstrapped)
        return;
      try {
        evaluateBanners();
        scheduleDailyReminder();
      } catch (e) {
        console.error("[chat] bootstrap", e);
        if (typeof common_vendor.index !== "undefined" && common_vendor.index.showToast) {
          common_vendor.index.showToast({ title: "加载异常，可继续聊天", icon: "none", duration: 2500 });
        }
      } finally {
        pageBootstrapped = true;
      }
    }
    function todayStr() {
      const d = /* @__PURE__ */ new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function yesterdayStr() {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function dayBeforeYesterdayStr() {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - 2);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function readHistory() {
      const h = core_storage.storageGet(STORAGE_HISTORY);
      return Array.isArray(h) ? h : [];
    }
    function writeHistory(arr) {
      core_storage.storageSet(STORAGE_HISTORY, arr.slice(-7));
    }
    function evaluateBanners() {
      const today = todayStr();
      const y = yesterdayStr();
      const dby = dayBeforeYesterdayStr();
      const checkin = core_storage.storageGet(STORAGE_CHECKIN);
      const hist = readHistory();
      bannerNoCheckin.value = !(checkin && checkin.date === today);
      const hasTodayH = hist.some((e) => e.date === today);
      const hasYH = hist.some((e) => e.date === y);
      const sorted = [...hist].sort((a, b) => b.date.localeCompare(a.date));
      const last = sorted[0];
      bannerGap.value = hist.length > 0 && !hasTodayH && !hasYH && last && last.date <= dby;
      const now = /* @__PURE__ */ new Date();
      const h = now.getHours();
      const afterEight = h > 20 || h === 20 && now.getMinutes() >= 0;
      bannerDaily.value = afterEight && !(checkin && checkin.date === today);
    }
    function scheduleDailyReminder() {
      if (dailyTimer)
        clearTimeout(dailyTimer);
      const now = /* @__PURE__ */ new Date();
      const target = /* @__PURE__ */ new Date();
      target.setHours(20, 0, 0, 0);
      if (now >= target)
        target.setDate(target.getDate() + 1);
      const ms = target.getTime() - now.getTime();
      dailyTimer = setTimeout(() => {
        const checkin = core_storage.storageGet(STORAGE_CHECKIN);
        const t = todayStr();
        if (!checkin || checkin.date !== t) {
          bannerDaily.value = true;
          if (typeof common_vendor.index !== "undefined" && common_vendor.index.showToast) {
            common_vendor.index.showToast({ title: "今天要不要来看看自己的状态？", icon: "none", duration: 2800 });
          }
        }
        scheduleDailyReminder();
      }, ms);
    }
    common_vendor.onLoad(() => {
      bootstrapPage();
    });
    common_vendor.onMounted(() => {
      bootstrapPage();
    });
    common_vendor.onUnmounted(() => {
      if (dailyTimer)
        clearTimeout(dailyTimer);
      if (checkinFlashTimer)
        clearTimeout(checkinFlashTimer);
    });
    function goCalendar() {
      if (typeof common_vendor.index !== "undefined" && common_vendor.index.navigateTo) {
        common_vendor.index.navigateTo({ url: "/pages/calendar/index" });
      }
    }
    const scrollToBottom = async () => {
      await common_vendor.nextTick$1();
      if (messages.value.length) {
        scrollTargetId.value = `m-${messages.value.length - 1}`;
      }
    };
    const isEmergency = (text) => String(text || "").includes("【紧急提示】");
    const emergencyHead = (text) => {
      const lines = String(text || "").split("\n");
      return lines[0] || "";
    };
    const displayBody = (msg) => {
      if (!msg.emergency)
        return msg.text;
      return String(msg.text || "").split("\n").slice(1).join("\n").trim();
    };
    const send = async () => {
      const text = userInput.value.trim();
      if (!text || isSending.value)
        return;
      messages.value.push({ role: "user", text, emergency: false });
      lastSentText.value = text;
      userInput.value = "";
      await scrollToBottom();
      loading.value = true;
      isSending.value = true;
      error.value = false;
      retry.value = false;
      errorText.value = "";
      canRetry.value = false;
      let slowTimer = setTimeout(() => {
        errorText.value = "响应较慢，可重试";
        retry.value = true;
      }, 1e4);
      try {
        const reply = await api_chat.requestChat({ inputText: text });
        const safeReply = reply != null && String(reply).trim() !== "" ? String(reply) : "稍后再试一次就好。";
        messages.value.push({
          role: "ai",
          text: safeReply,
          emergency: isEmergency(safeReply)
        });
        try {
          evaluateBanners();
        } catch (err) {
          console.error("[chat] evaluateBanners", err);
        }
      } catch (e) {
        console.error(e);
        error.value = true;
        retry.value = true;
        errorText.value = "响应较慢，可重试";
        canRetry.value = true;
        messages.value.push({
          role: "ai",
          text: "网络不稳定，已为你保留输入内容，可再点发送。",
          emergency: false
        });
        if (typeof common_vendor.index !== "undefined" && common_vendor.index.showToast) {
          common_vendor.index.showToast({ title: "请求未完成", icon: "none", duration: 2e3 });
        }
      } finally {
        clearTimeout(slowTimer);
        loading.value = false;
        isSending.value = false;
        await scrollToBottom();
      }
    };
    const retrySend = async () => {
      if (!lastSentText.value || isSending.value)
        return;
      userInput.value = lastSentText.value;
      canRetry.value = false;
      await send();
    };
    const onCheckIn = () => {
      const today = todayStr();
      const existing = core_storage.storageGet(STORAGE_CHECKIN);
      if (existing && existing.date === today) {
        if (typeof common_vendor.index !== "undefined" && common_vendor.index.showToast) {
          common_vendor.index.showToast({ title: "今天已经记录过了", icon: "none" });
        }
        return;
      }
      let snap = core_storage.storageGet(STORAGE_LAST_EMOTION);
      const needDefault = !snap || !snap.tag || !snap.primaryEmotion && !snap.state;
      if (needDefault) {
        const def = core_emotionEngine.getDefaultCheckInSnapshot();
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
          date: todayStr()
        };
        core_storage.storageSet(STORAGE_LAST_EMOTION, snap);
      } else if (!snap.primaryEmotion && snap.state) {
        snap = { ...snap, primaryEmotion: snap.state };
      }
      const pe = snap.primaryEmotion || snap.state || "reflective";
      const entry = {
        date: today,
        emotion: pe,
        primaryEmotion: pe,
        secondaryEmotion: snap.secondaryEmotion || "reflective",
        contextType: snap.contextType || "general",
        keywordsMatched: Array.isArray(snap.keywordsMatched) ? snap.keywordsMatched : [],
        tag: snap.tag,
        metaphor: snap.metaphor || "—",
        empathyLine: snap.empathyLine || "",
        summary: snap.summary || `${pe} · ${snap.tag}`
      };
      core_storage.storageSet(STORAGE_CHECKIN, entry);
      const hist = readHistory();
      hist.push(entry);
      writeHistory(hist);
      if (typeof common_vendor.index !== "undefined" && common_vendor.index.showToast) {
        common_vendor.index.showToast({ title: "已帮你记下今天的状态", icon: "none", duration: 2e3 });
      }
      checkinBtnLabel.value = "已记录 ✓";
      checkinPressed.value = true;
      if (checkinFlashTimer)
        clearTimeout(checkinFlashTimer);
      checkinFlashTimer = setTimeout(() => {
        checkinBtnLabel.value = "记录一下";
        checkinPressed.value = false;
      }, 1500);
      evaluateBanners();
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.o(goCalendar, "d1"),
        b: bannerNoCheckin.value
      }, bannerNoCheckin.value ? {} : {}, {
        c: bannerGap.value
      }, bannerGap.value ? {} : {}, {
        d: bannerDaily.value
      }, bannerDaily.value ? {} : {}, {
        e: messages.value.length
      }, messages.value.length ? {
        f: common_vendor.f(messages.value, (msg, index, i0) => {
          return common_vendor.e({
            a: msg.role === "ai" && msg.emergency
          }, msg.role === "ai" && msg.emergency ? {
            b: common_vendor.t(emergencyHead(msg.text))
          } : {}, {
            c: common_vendor.t(displayBody(msg)),
            d: `m-${index}`,
            e: common_vendor.n(msg.role),
            f: common_vendor.n(msg.emergency ? "emergency" : ""),
            g: index,
            h: common_vendor.n(msg.role)
          });
        }),
        g: scrollTargetId.value
      } : {}, {
        h: loading.value
      }, loading.value ? {} : {}, {
        i: errorText.value
      }, errorText.value ? {
        j: common_vendor.t(errorText.value)
      } : {}, {
        k: isSending.value,
        l: common_vendor.o(send, "cd"),
        m: userInput.value,
        n: common_vendor.o(($event) => userInput.value = $event.detail.value, "da"),
        o: common_vendor.t(isSending.value ? "…" : "发送"),
        p: isSending.value,
        q: common_vendor.o(send, "c9"),
        r: canRetry.value
      }, canRetry.value ? {
        s: common_vendor.o(retrySend, "23")
      } : {}, {
        t: common_vendor.t(checkinBtnLabel.value),
        v: checkinPressed.value ? 1 : "",
        w: common_vendor.o(onCheckIn, "93")
      });
    };
  }
};
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-da04a0a0"]]);
wx.createPage(MiniProgramPage);
