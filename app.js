const choices = {
  persona: "ice",
  runup: "stutter",
  target: "center-low",
  keeper: "hold",
  pressure: 68,
  noise: true,
};

const personas = {
  ice: {
    name: "冷面队长",
    bonus: 8,
    meme: 36,
    line: "表情像赛前发布会，脚法像最后一页剧本。",
    titles: ["队长把心跳藏进球袜", "冷面队长把门将骗到静音模式"],
  },
  poet: {
    name: "浪漫左脚",
    bonus: 3,
    meme: 58,
    line: "这一脚不像射门，像给门柱写情书。",
    titles: ["浪漫左脚给横梁寄明信片", "球网收到一首弧线诗"],
  },
  chaos: {
    name: "整活替补",
    bonus: -2,
    meme: 88,
    line: "替补席负责祈祷，他负责把剧本掰弯。",
    titles: ["替补上来第一脚，全网开始截表情包", "整活的人，连压力都要加戏"],
  },
  rookie: {
    name: "初登大赛",
    bonus: -6,
    meme: 66,
    line: "耳边全是噪声，眼里只有那块白点。",
    titles: ["新人站上点球点，世界突然很安静", "首秀点球把成长线拉满"],
  },
};

const runups = {
  stutter: { name: "碎步停顿", bonus: 5, risk: 8, line: "停顿那一下，门将的人生也暂停了。" },
  rocket: { name: "直线爆冲", bonus: 1, risk: 14, line: "助跑像冲刺抢地铁，胜负全靠一口气。" },
  walk: { name: "散步骗术", bonus: 3, risk: 4, line: "慢得像要问路，狠得像早就知道答案。" },
};

const targets = {
  "left-high": { name: "左上死角", side: "left", height: "high", bonus: -5, risk: 18, glory: 26 },
  "center-high": { name: "中路高球", side: "center", height: "high", bonus: -8, risk: 22, glory: 34 },
  "right-high": { name: "右上死角", side: "right", height: "high", bonus: -5, risk: 18, glory: 26 },
  "left-low": { name: "左下贴地", side: "left", height: "low", bonus: 4, risk: 8, glory: 12 },
  "center-low": { name: "中路勺子", side: "center", height: "low", bonus: -2, risk: 16, glory: 32 },
  "right-low": { name: "右下贴地", side: "right", height: "low", bonus: 4, risk: 8, glory: 12 },
};

const keeperReads = {
  left: { name: "门将提前扑左", side: "left" },
  hold: { name: "门将站住读秒", side: "center" },
  right: { name: "门将提前扑右", side: "right" },
};

const stateKey = "penaltyOracleHistoryV1";
const maxHistory = 3;
let history = loadHistory();
let latestReport = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const pitch = $("#pitch");
const pressure = $("#pressure");
const pressureOutput = $("#pressure-output");
const noiseToggle = $("#noise-toggle");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(stateKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(stateKey, JSON.stringify(history));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function updateChoiceButtons(control, value) {
  const root = document.querySelector(`[data-control="${control}"]`);
  if (!root) return;
  $$("button", root).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function syncView() {
  pressureOutput.textContent = choices.pressure;
  pitch.dataset.target = choices.target;
  pitch.dataset.keeper = choices.keeper;
}

function calculateReport() {
  const persona = personas[choices.persona];
  const runup = runups[choices.runup];
  const target = targets[choices.target];
  const keeper = keeperReads[choices.keeper];
  const pressurePenalty = Math.round(Math.max(0, choices.pressure - 42) * 0.34);
  const noisePenalty = choices.noise ? 5 : 0;
  const keeperMatch = keeper.side === target.side;
  const keeperBonus = keeperMatch ? -22 : 16;
  const centerDrama = target.side === "center" && keeper.side !== "center" ? 10 : 0;
  const goalRate = clamp(68 + persona.bonus + runup.bonus + target.bonus + keeperBonus + centerDrama - pressurePenalty - noisePenalty, 5, 96);
  const seed = hashText(`${Date.now()}-${JSON.stringify(choices)}`);
  const roll = seed % 100;
  let outcome = roll < goalRate ? "goal" : "save";

  if (target.height === "high" && roll > 88 - Math.floor(target.risk / 4)) outcome = "post";
  if (choices.pressure > 82 && Math.abs(roll - goalRate) < 4) outcome = "var";

  const memeScore = clamp(persona.meme + runup.risk + target.glory + Math.round(choices.pressure / 3) + (keeperMatch ? 10 : 0), 18, 99);
  const varScore = clamp(Math.round((choices.pressure + target.risk + (outcome === "var" ? 60 : 0)) / 2), 3, 99);
  const title = createTitle(outcome, seed, persona, target, keeper);
  const copy = createCopy(outcome, persona, runup, target, keeper, goalRate);
  const timeline = createTimeline(outcome, persona, runup, target, keeper);

  return {
    id: seed,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    outcome,
    tag: outcomeTag(outcome),
    score: outcomeScore(outcome),
    title,
    copy,
    timeline,
    persona: persona.name,
    runup: runup.name,
    target: target.name,
    keeper: keeper.name,
    goalRate,
    memeScore,
    varScore,
  };
}

function outcomeTag(outcome) {
  return {
    goal: "球进了",
    save: "被扑出",
    post: "击中门框",
    var: "VAR介入",
  }[outcome];
}

function outcomeScore(outcome) {
  return {
    goal: "GOAL",
    save: "SAVE",
    post: "POST",
    var: "VAR",
  }[outcome];
}

function createTitle(outcome, seed, persona, target, keeper) {
  const titlePool = {
    goal: [
      `${target.name}打穿夜色，门将只扑到空气`,
      pick(persona.titles, seed),
      `门将选择${keeper.name.replace("门将", "")}，球选择上头条`,
    ],
    save: [
      `门将猜中剧本，主罚者被写进叹息区`,
      `${target.name}被读心，替补席集体抱头`,
      `这一扑，像把整座球场按下静音键`,
    ],
    post: [
      `${target.name}亲吻门框，全场心跳漏一拍`,
      `横梁拒收浪漫，点球点留下回声`,
      `差一厘米封神，差一厘米成梗`,
    ],
    var: [
      `球还在路上，VAR已经开始加班`,
      `点球点前剧情反转，裁判把全场拖进番外篇`,
      `门线、脚尖和心跳，一起等待判决`,
    ],
  };
  return pick(titlePool[outcome], seed);
}

function createCopy(outcome, persona, runup, target, keeper, goalRate) {
  const verdict = {
    goal: "球网先动，全场后懂。这个选择不只赢了一球，还赢了赛后所有慢镜头。",
    save: "门将把这脚球读成了开卷题。压力没有爆炸，只是换了个方向砸向主罚者。",
    post: "它离完美只差一声清脆的门框。足球有时候不是圆的，是故意拐弯的剧情。",
    var: "这不是点球，这是悬疑片。每个人都在等一个手势，连空气都不敢提前庆祝。",
  }[outcome];

  return `${persona.line} ${runup.line} 你选择${target.name}，而${keeper.name}。模型给出的进球率是 ${goalRate}%。${verdict}`;
}

function createTimeline(outcome, persona, runup, target, keeper) {
  const finalLine = {
    goal: "球网抖了一下，替补席像被按下弹射按钮。",
    save: "门将落地后先看球，再看世界有没有变慢。",
    post: "门框发出一声金属提示音：本次传奇未保存。",
    var: "裁判摸向耳机，全场进入加载界面。",
  }[outcome];

  return [
    `${persona.name}站上白点，镜头给到鞋带特写。`,
    `${runup.name}启动，${keeper.name}，评论区开始预判评论区。`,
    `${target.name}出脚，皮球把所有人的表情拉成慢动作。`,
    finalLine,
  ];
}

function renderReport(report) {
  latestReport = report;
  $("#result-tag").textContent = report.tag;
  $("#result-score").textContent = report.score;
  $("#result-title").textContent = report.title;
  $("#result-copy").textContent = report.copy;
  $("#metric-goal").textContent = `${report.goalRate}%`;
  $("#metric-meme").textContent = report.memeScore;
  $("#metric-var").textContent = report.varScore;
  $("#timeline").innerHTML = report.timeline.map((item) => `<li>${item}</li>`).join("");
  drawPoster(report);
}

function kick() {
  const report = calculateReport();
  pitch.classList.remove("is-kicking");
  void pitch.offsetWidth;
  pitch.classList.add("is-kicking");
  renderReport(report);
  history = [report, ...history.filter((item) => item.id !== report.id)].slice(0, maxHistory);
  saveHistory();
  renderHistory();
}

function resetChoices() {
  Object.assign(choices, {
    persona: "ice",
    runup: "stutter",
    target: "center-low",
    keeper: "hold",
    pressure: 68,
    noise: true,
  });
  pressure.value = choices.pressure;
  noiseToggle.checked = choices.noise;
  ["persona", "runup", "target", "keeper"].forEach((key) => updateChoiceButtons(key, choices[key]));
  syncView();
  showToast("已重置到赛前默认剧本");
}

function renderHistory() {
  const list = $("#history-list");
  if (!history.length) {
    list.innerHTML = '<div class="history-item"><strong>还没有赛后档案</strong><span>先开一脚点球。</span></div>';
    return;
  }
  list.innerHTML = history.map((item) => `
    <button class="history-item" type="button" data-id="${item.id}">
      <strong>${item.title}</strong>
      <span>${item.createdAt} · ${item.score} · ${item.goalRate}%</span>
    </button>
  `).join("");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const chars = [...text];
  let line = "";
  let lines = 0;
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function drawPoster(report) {
  const canvas = $("#poster-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fbfaf3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f3b29";
  ctx.fillRect(0, 0, canvas.width, 470);
  ctx.fillStyle = "#ffd84d";
  ctx.fillRect(0, 420, canvas.width, 52);
  ctx.fillStyle = "#e64636";
  ctx.fillRect(0, 472, canvas.width, 18);

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 6;
  for (let x = 80; x < canvas.width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 72);
    ctx.lineTo(x + 190, 400);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 52px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("点球宇宙", 76, 118);
  ctx.font = "800 28px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("PENALTY ORACLE / WORLD CUP SIDE PROJECT", 78, 168);

  ctx.fillStyle = "#ffd84d";
  ctx.font = "900 138px Inter, Arial, sans-serif";
  ctx.fillText(report.score, 76, 350);

  ctx.fillStyle = "#142033";
  ctx.font = "900 54px PingFang SC, Microsoft YaHei, sans-serif";
  wrapText(ctx, report.title, 76, 610, 1040, 68, 3);

  ctx.fillStyle = "#5d6678";
  ctx.font = "700 30px PingFang SC, Microsoft YaHei, sans-serif";
  wrapText(ctx, report.copy, 76, 820, 1040, 48, 6);

  const metrics = [
    ["进球率", `${report.goalRate}%`],
    ["梗指数", report.memeScore],
    ["VAR戏份", report.varScore],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 76 + index * 350;
    ctx.strokeStyle = "#d8decb";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 1110, 300, 170);
    ctx.fillStyle = "#5d6678";
    ctx.font = "800 28px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(label, x + 24, 1162);
    ctx.fillStyle = "#142033";
    ctx.font = "900 64px Inter, Arial, sans-serif";
    ctx.fillText(String(value), x + 24, 1242);
  });

  ctx.fillStyle = "#142033";
  ctx.font = "800 30px PingFang SC, Microsoft YaHei, sans-serif";
  wrapText(ctx, `配置：${report.persona} / ${report.runup} / ${report.target} / ${report.keeper}`, 76, 1378, 1040, 46, 2);

  ctx.fillStyle = "#e64636";
  ctx.font = "900 28px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("share from Penalty Oracle", 76, 1505);
}

async function copyReport() {
  if (!latestReport) {
    showToast("先开一脚，再复制战报");
    return;
  }
  const text = `【点球宇宙】${latestReport.title}\n${latestReport.copy}\n进球率 ${latestReport.goalRate}% / 梗指数 ${latestReport.memeScore} / VAR戏份 ${latestReport.varScore}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast("战报已复制");
  } catch {
    showToast("浏览器不允许复制，请手动选中文字");
  }
}

function downloadPoster() {
  if (!latestReport) {
    showToast("先开一脚，再下载小报");
    return;
  }
  const canvas = $("#poster-canvas");
  const link = document.createElement("a");
  link.download = `penalty-oracle-${latestReport.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const control = button.parentElement?.dataset.control;
  if (control && button.dataset.value) {
    choices[control] = button.dataset.value;
    updateChoiceButtons(control, choices[control]);
    syncView();
  }

  const historyButton = button.closest(".history-item[data-id]");
  if (historyButton) {
    const report = history.find((item) => String(item.id) === historyButton.dataset.id);
    if (report) {
      renderReport(report);
      showToast("已载入这份赛后档案");
    }
  }
});

pressure.addEventListener("input", () => {
  choices.pressure = Number(pressure.value);
  syncView();
});

noiseToggle.addEventListener("change", () => {
  choices.noise = noiseToggle.checked;
});

$("#kick-button").addEventListener("click", kick);
$("#reset-button").addEventListener("click", resetChoices);
$("#copy-button").addEventListener("click", copyReport);
$("#download-button").addEventListener("click", downloadPoster);

syncView();
renderHistory();
