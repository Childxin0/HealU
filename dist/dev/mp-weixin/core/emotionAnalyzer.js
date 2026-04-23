"use strict";
const core_contextSignals = require("./contextSignals.js");
const core_emotionSignals = require("./emotionSignals.js");
const EMOTION_IDS = ["anxious", "low_energy", "unstable", "sad", "reflective"];
function applyContextBoost(contextType, scores) {
  const b = { ...scores };
  switch (contextType) {
    case "breakup":
      b.sad += 14;
      b.unstable += 8;
      b.anxious += 4;
      break;
    case "grief":
      b.sad += 22;
      b.reflective += 12;
      b.low_energy += 10;
      b.unstable += 6;
      break;
    case "family":
      b.anxious += 10;
      b.sad += 6;
      b.unstable += 4;
      break;
    case "body":
      b.low_energy += 12;
      b.anxious += 6;
      b.sad += 4;
      break;
    case "study_stress":
      b.anxious += 12;
      b.low_energy += 8;
      b.unstable += 3;
      break;
    case "work_stress":
      b.anxious += 10;
      b.low_energy += 10;
      b.unstable += 4;
      break;
    case "loneliness":
      b.sad += 12;
      b.anxious += 6;
      b.reflective += 4;
      break;
    case "neglect":
      b.sad += 10;
      b.unstable += 8;
      b.anxious += 6;
      break;
    case "self_negation":
      b.sad += 12;
      b.low_energy += 8;
      b.anxious += 5;
      break;
  }
  EMOTION_IDS.forEach((id) => {
    b[id] = Math.max(0, b[id]);
  });
  return b;
}
function analyzeEmotion(text) {
  var _a;
  const raw = String(text || "").trim();
  const { contextType, keywordsMatched } = core_contextSignals.detectContext(raw);
  const scores = {};
  EMOTION_IDS.forEach((id) => {
    scores[id] = 0;
  });
  for (const rule of core_emotionSignals.EMOTION_SEMANTIC_RULES) {
    try {
      if (rule.test(raw)) {
        Object.entries(rule.add).forEach(([k, v]) => {
          if (scores[k] !== void 0)
            scores[k] += v;
        });
      }
    } catch {
    }
  }
  for (const pm of core_emotionSignals.PATTERN_MULTIPLIERS) {
    try {
      if (pm.test(raw)) {
        Object.entries(pm.boost).forEach(([k, v]) => {
          if (scores[k] !== void 0)
            scores[k] += v;
        });
      }
    } catch {
    }
  }
  if (raw.length > 140)
    scores.reflective += 8;
  else if (raw.length > 60)
    scores.reflective += 4;
  const intensWord = (raw.match(/真的|特别|非常|好|太|极其|快要/g) || []).length;
  EMOTION_IDS.forEach((id) => {
    if (id !== "reflective")
      scores[id] += intensWord * 3;
  });
  const boosted = applyContextBoost(contextType, scores);
  const sorted = EMOTION_IDS.map((id) => [id, boosted[id]]).sort((a, b) => b[1] - a[1]);
  let primary = sorted[0][0];
  let secondary = sorted[1][0];
  let top = sorted[0][1];
  if (top < 8) {
    primary = "reflective";
    const alt = sorted.find(([id, v]) => id !== "reflective" && v > 0);
    secondary = alt ? alt[0] : "low_energy";
    top = boosted[primary];
  }
  if (primary === secondary) {
    secondary = ((_a = sorted.find(([id]) => id !== primary)) == null ? void 0 : _a[0]) || "sad";
  }
  if (boosted[secondary] < boosted[primary] * 0.25 && boosted[primary] >= 12) {
    const runner = sorted.find(([id, v]) => id !== primary && v >= boosted[primary] * 0.35);
    if (runner)
      secondary = runner[0];
  }
  const intensity = Math.min(
    100,
    Math.round(
      22 + Math.min(boosted[primary], 48) * 1.35 + intensWord * 7 + raw.length * 0.06 + (contextType !== "general" ? 6 : 0)
    )
  );
  const denom = boosted[primary] + boosted[secondary] + 1;
  let confidence = 0.3 + (boosted[primary] - boosted[secondary]) / denom;
  confidence = Math.min(0.94, Math.max(0.22, confidence));
  return {
    primaryEmotion: primary,
    secondaryEmotion: secondary,
    intensity,
    confidence: Number(confidence.toFixed(2)),
    contextType,
    keywordsMatched: [...keywordsMatched],
    scores: { ...boosted }
  };
}
exports.analyzeEmotion = analyzeEmotion;
