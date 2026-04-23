"use strict";
const core_emotionAnalyzer = require("./emotionAnalyzer.js");
const core_empathyBuilder = require("./empathyBuilder.js");
const core_actionGenerator = require("./actionGenerator.js");
const core_contentGenerator = require("./contentGenerator.js");
const core_storage = require("./storage.js");
const STORAGE_HISTORY = "healU_history";
const STORAGE_LAST_EMOTION = "healU_last_emotion";
const MEDICAL_RED = ["胸痛", "呼吸困难", "出冷汗"];
const SPACE_EMOTION = {
  anxious: "想太多回旋走廊",
  low_energy: "缓慢降速区",
  unstable: "情绪波动带",
  sad: "低饱和度回廊",
  reflective: "留白观察厅",
  stable: "平稳运行区"
};
const SPACE_CONTEXT = {
  breakup: "关系收束回廊",
  grief: "告别与思念厅",
  family: "家庭张力厅",
  body: "身体信号区",
  study_stress: "学业挤压带",
  work_stress: "任务回旋区",
  loneliness: "独处回声廊",
  neglect: "被看见的缺口",
  self_negation: "自我苛责坑道"
};
function resolveSpaceName(primaryEmotion, contextType) {
  if (contextType && contextType !== "general" && SPACE_CONTEXT[contextType]) {
    return SPACE_CONTEXT[contextType];
  }
  return SPACE_EMOTION[primaryEmotion] || SPACE_EMOTION.reflective;
}
function todayStr() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yesterdayStr() {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function readHistory() {
  const h = core_storage.storageGet(STORAGE_HISTORY);
  return Array.isArray(h) ? h : [];
}
function writeLastEmotion(payload) {
  core_storage.storageSet(STORAGE_LAST_EMOTION, payload);
}
function yesterdayBanner() {
  const hist = readHistory();
  const yd = yesterdayStr();
  const hit = hist.find((h) => h.date === yd);
  if (!hit)
    return "";
  const emo = hit.primaryEmotion || hit.emotion || hit.state || "reflective";
  const ctx = hit.contextType || "general";
  const space = resolveSpaceName(emo, ctx);
  return `你昨天在：
HealU · ${space}

今天感觉有变化吗？

`;
}
function getDefaultCheckInSnapshot() {
  const { tag, metaphor } = core_contentGenerator.generateTagAndMetaphor("reflective", "general");
  const empathyLine = core_empathyBuilder.buildEmpathyLine("", "reflective", "general");
  return {
    primaryEmotion: "reflective",
    secondaryEmotion: "stable",
    contextType: "general",
    keywordsMatched: [],
    spaceName: resolveSpaceName("reflective", "general"),
    tag,
    metaphor,
    empathyLine,
    summary: "今天在 HealU 留了一个平静锚点"
  };
}
function process(userInput) {
  const raw = String(userInput || "").trim();
  if (MEDICAL_RED.some((w) => raw.includes(w))) {
    writeLastEmotion(null);
    return "【紧急提示】\n请立即就医或联系急救服务";
  }
  if (!raw) {
    return "说说你现在的感觉吧，一句话也可以。";
  }
  const analysis = core_emotionAnalyzer.analyzeEmotion(raw);
  const {
    primaryEmotion,
    secondaryEmotion,
    intensity,
    confidence,
    contextType,
    keywordsMatched
  } = analysis;
  const space = resolveSpaceName(primaryEmotion, contextType);
  const { tag, metaphor } = core_contentGenerator.generateTagAndMetaphor(primaryEmotion, contextType);
  const [actMicro, actEnv, actCog] = core_actionGenerator.generateBufferingActions(contextType);
  const avoid = core_actionGenerator.generateAvoidLine(contextType);
  const empathy = core_empathyBuilder.buildEmpathyLine(raw, primaryEmotion, contextType);
  const summary = `「${tag}」· ${space}`;
  const payload = {
    date: todayStr(),
    primaryEmotion,
    secondaryEmotion,
    intensity,
    confidence,
    contextType,
    keywordsMatched,
    tag,
    metaphor,
    summary,
    empathyLine: empathy,
    space,
    analysis
  };
  writeLastEmotion(payload);
  const prefix = yesterdayBanner();
  const body = [
    `你现在在：
HealU · ${space}`,
    "",
    `你现在更像是：
「${tag}」`,
    "",
    empathy,
    "",
    "🧭 给你的当前落点",
    `- ${actMicro}`,
    `- ${actEnv}`,
    `- ${actCog}`,
    "",
    "🚧 先别往这边走",
    `- ${avoid}`,
    "",
    "📝 留个小标记",
    "- 点「记录一下」，沉淀今天的状态"
  ].join("\n");
  return prefix + body;
}
exports.getDefaultCheckInSnapshot = getDefaultCheckInSnapshot;
exports.process = process;
