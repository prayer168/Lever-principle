/* 槓桿原理互動教材 v1.0.0 */
(function () {
  "use strict";

  /* ════════ 頁籤（含鍵盤操作） ════════ */
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  function activateTab(tab) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
    });
    panels.forEach((p) => {
      const show = p.id === tab.getAttribute("aria-controls");
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
    stopAnimTimer(); // 離開動畫頁時停止自動播放
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (e) => {
      let idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) {
        e.preventDefault();
        activateTab(tabs[idx]);
        tabs[idx].focus();
      }
    });
  });

  /* ════════ 互動實驗：槓桿實驗器 ════════ */
  const TICK = 26; // 每格像素
  const CX = 400; // 支點 x
  const BEAM_Y = 230; // 橫桿中心 y
  const beamGroup = document.getElementById("lab-beam-group");
  const ticksG = document.getElementById("lab-ticks");
  const leftWG = document.getElementById("lab-left-weight");
  const rightWG = document.getElementById("lab-right-weight");
  const statusEl = document.getElementById("lab-status");
  const sliders = {
    lm: document.getElementById("left-mass"),
    ld: document.getElementById("left-dist"),
    rm: document.getElementById("right-mass"),
    rd: document.getElementById("right-dist"),
  };
  const outs = {
    lm: document.getElementById("left-mass-out"),
    ld: document.getElementById("left-dist-out"),
    rm: document.getElementById("right-mass-out"),
    rd: document.getElementById("right-dist-out"),
    lt: document.getElementById("left-torque"),
    rt: document.getElementById("right-torque"),
  };

  // 畫刻度
  (function drawTicks() {
    const NS = "http://www.w3.org/2000/svg";
    let html = "";
    for (let i = 1; i <= 10; i++) {
      [CX - i * TICK, CX + i * TICK].forEach((x) => {
        html += `<line x1="${x}" y1="${BEAM_Y - 8}" x2="${x}" y2="${BEAM_Y + 8}" stroke="#92400e" stroke-width="1.5"/>`;
      });
      if (i % 2 === 0) {
        html += `<text x="${CX - i * TICK}" y="${BEAM_Y - 12}" text-anchor="middle" font-size="12" fill="#78350f">${i}</text>`;
        html += `<text x="${CX + i * TICK}" y="${BEAM_Y - 12}" text-anchor="middle" font-size="12" fill="#78350f">${i}</text>`;
      }
    }
    ticksG.innerHTML = html;
  })();

  function drawWeights(group, side, mass, dist, angle) {
    const x = CX + (side === "L" ? -1 : 1) * dist * TICK;
    const color = side === "L" ? "#2563eb" : "#e11d48";
    const dark = side === "L" ? "#1e40af" : "#9f1239";
    let html = `<line x1="${x}" y1="${BEAM_Y + 8}" x2="${x}" y2="${BEAM_Y + 22}" stroke="#555" stroke-width="2.5"/>`;
    for (let i = 0; i < mass; i++) {
      const y = BEAM_Y + 24 + i * 9;
      html += `<rect x="${x - 14}" y="${y}" width="28" height="8" rx="3.5" fill="${color}" stroke="${dark}" stroke-width="1.2"/>`;
    }
    html += `<text x="${x}" y="${BEAM_Y + 24 + mass * 9 + 15}" text-anchor="middle" font-size="14" font-weight="bold" fill="${dark}">${mass}個</text>`;
    // 砝碼隨重力保持垂直：抵銷橫桿旋轉
    group.setAttribute("transform", `rotate(${-angle} ${x} ${BEAM_Y + 8})`);
    group.innerHTML = html;
  }

  function updateLab() {
    const lm = +sliders.lm.value, ld = +sliders.ld.value;
    const rm = +sliders.rm.value, rd = +sliders.rd.value;
    const L = lm * ld, R = rm * rd;
    outs.lm.value = lm; outs.ld.value = ld; outs.rm.value = rm; outs.rd.value = rd;
    outs.lt.value = L; outs.rt.value = R;
    const angle = Math.max(-13, Math.min(13, (R - L) * 0.45));
    beamGroup.style.transform = `rotate(${angle}deg)`;
    drawWeights(leftWG, "L", lm, ld, angle);
    drawWeights(rightWG, "R", rm, rd, angle);
    if (L === R) {
      statusEl.textContent = `平衡！左右力矩都是 ${L}（砝碼數 × 格數相等）`;
      statusEl.classList.remove("tilt");
    } else {
      statusEl.textContent = `${L > R ? "向左傾斜" : "向右傾斜"}：左邊力矩 ${L}，右邊力矩 ${R}，${L > R ? "左" : "右"}邊比較大。`;
      statusEl.classList.add("tilt");
    }
    checkChallenge(L, R);
  }

  Object.values(sliders).forEach((s) => s.addEventListener("input", updateLab));

  document.getElementById("lab-reset").addEventListener("click", () => {
    sliders.lm.value = 4; sliders.ld.value = 3;
    sliders.rm.value = 4; sliders.rd.value = 3;
    endChallenge();
    updateLab();
  });

  /* ── 平衡挑戰 ── */
  const challengeText = document.getElementById("challenge-text");
  const challengeResult = document.getElementById("challenge-result");
  const btnChalStart = document.getElementById("challenge-start");
  const btnChalNew = document.getElementById("challenge-new");
  let challengeOn = false;
  // 每題左側固定值都有兩組以上 (砝碼, 格數) 解，確保「答案不只一種」
  const CHALLENGES = [
    { m: 6, d: 4 }, // 24 → 3×8, 4×6, 6×4, 8×3
    { m: 4, d: 3 }, // 12 → 2×6, 3×4, 4×3, 6×2
    { m: 9, d: 2 }, // 18 → 2×9, 3×6, 6×3, 9×2
    { m: 5, d: 4 }, // 20 → 2×10, 4×5, 5×4, 10×2
    { m: 8, d: 2 }, // 16 → 2×8, 4×4, 8×2
  ];
  let chalIdx = 0;

  function startChallenge() {
    challengeOn = true;
    const c = CHALLENGES[chalIdx % CHALLENGES.length];
    sliders.lm.value = c.m; sliders.ld.value = c.d;
    sliders.lm.disabled = true; sliders.ld.disabled = true;
    sliders.rm.value = 1; sliders.rd.value = 1;
    challengeText.innerHTML = `左邊固定掛 <strong>${c.m} 個砝碼在第 ${c.d} 格</strong>。請只調整<strong>右邊</strong>，讓槓桿平衡。（提示：答案不只一種！）`;
    challengeResult.textContent = "調整右邊的砝碼數和格數試試看…";
    challengeResult.className = "";
    btnChalStart.hidden = true;
    btnChalNew.hidden = false;
    updateLab();
  }

  function endChallenge() {
    challengeOn = false;
    sliders.lm.disabled = false; sliders.ld.disabled = false;
    btnChalStart.hidden = false;
    btnChalNew.hidden = true;
    challengeResult.textContent = "";
    challengeResult.className = "";
  }

  function checkChallenge(L, R) {
    if (!challengeOn) return;
    if (L === R) {
      challengeResult.textContent = `🎉 成功平衡！${sliders.rm.value} 個砝碼 × 第 ${sliders.rd.value} 格 ＝ ${R}，和左邊一樣。還能找到別的組合嗎？`;
      challengeResult.className = "ok";
    } else {
      challengeResult.textContent = `還沒平衡：右邊力矩 ${R}，目標 ${L}。${R < L ? "再加重一點或掛遠一點" : "減輕一點或掛近一點"}。`;
      challengeResult.className = "no";
    }
  }

  btnChalStart.addEventListener("click", startChallenge);
  btnChalNew.addEventListener("click", () => { chalIdx++; startChallenge(); });

  /* ════════ 動畫：撬石頭 ════════ */
  const anim = {
    barGroup: document.getElementById("an-bar-group"),
    fulcrumTri: document.getElementById("an-fulcrum-tri"),
    bigrock: document.getElementById("an-bigrock"),
    force: document.getElementById("an-force"),
    forceLine: document.getElementById("an-force-line"),
    forceHead: document.getElementById("an-force-head"),
    forceLabel: document.getElementById("an-force-label"),
    noteLoad: document.getElementById("an-note-load"),
    noteFulcrum: document.getElementById("an-note-fulcrum"),
    noteArm: document.getElementById("an-note-arm"),
    caption: document.getElementById("anim-caption"),
    stageLabel: document.getElementById("anim-stage-label"),
  };
  let animStage = 0;
  let animTimer = null;
  // 支點位置：棒身斜率 -15°，支點頂點必須落在棒身下緣
  const F_FAR = { x: 290, y: 341, tri: "290,341 266,380 314,380" };
  const F_NEAR = { x: 225, y: 358, tri: "225,358 203,380 247,380" };

  const STAGES = [
    {
      caption: "任務現場：長棒的一端插進大石頭下方，中段架在小石塊上，另一端翹在空中。",
      apply() {
        setBar(0, F_FAR); setFulcrum(F_FAR); setRock(0);
        setForce(false); setNotes(false, false, false);
      },
    },
    {
      caption: "認識三要素：大石頭壓住棒尖的位置是「抗力點」，小石塊是「支點」，手壓的另一端就是「施力點」。",
      apply() {
        setBar(0, F_FAR); setFulcrum(F_FAR); setRock(0);
        setForce(false); setNotes(true, true, false);
      },
    },
    {
      caption: "用力往下壓！當「施力×施力臂」大於「抗力×抗力臂」，大石頭就被撬起來了。但現在支點離石頭比較遠，需要很大的力。",
      apply() {
        setBar(10, F_FAR); setFulcrum(F_FAR); setRock(-18);
        setForce(true, 90, 296, "施力：大"); setNotes(true, true, false);
      },
    },
    {
      caption: "換個位置：把支點小石塊移近大石頭。這樣「施力臂」變長、「抗力臂」變短。",
      apply() {
        setBar(0, F_NEAR); setFulcrum(F_NEAR); setRock(0);
        setForce(false); setNotes(true, true, true);
      },
    },
    {
      caption: "再壓一次：同一顆石頭，現在只要小小的力就能撬起！代價是：手要往下壓更長的距離。這就是「省力費時」。",
      apply() {
        setBar(10, F_NEAR); setFulcrum(F_NEAR); setRock(-8);
        setForce(true, 45, 308, "施力：小"); setNotes(true, true, true);
      },
    },
  ];

  function setBar(deg, f) {
    anim.barGroup.style.transformOrigin = `${f.x}px ${f.y}px`;
    anim.barGroup.style.transform = `rotate(${deg}deg)`;
  }
  function setFulcrum(f) {
    anim.fulcrumTri.setAttribute("points", f.tri);
    anim.noteFulcrum.setAttribute("x", String(f.x));
  }
  function setRock(dy) {
    anim.bigrock.style.transform = `translateY(${dy}px)`;
  }
  function setForce(show, len, tipY, label) {
    anim.force.style.opacity = show ? "1" : "0";
    if (show) {
      anim.forceLine.setAttribute("y1", String(tipY - len - 16));
      anim.forceLine.setAttribute("y2", String(tipY - 18));
      anim.forceHead.setAttribute("points", `690,${tipY} 677,${tipY - 22} 703,${tipY - 22}`);
      anim.forceLabel.setAttribute("y", String(tipY - len - 26));
      anim.forceLabel.textContent = label;
    }
  }
  function setNotes(load, fulcrum, arm) {
    anim.noteLoad.style.opacity = load ? "1" : "0";
    anim.noteFulcrum.style.opacity = fulcrum ? "1" : "0";
    anim.noteArm.style.opacity = arm ? "1" : "0";
  }

  function showStage(n) {
    animStage = Math.max(0, Math.min(STAGES.length - 1, n));
    STAGES[animStage].apply();
    anim.caption.textContent = STAGES[animStage].caption;
    anim.stageLabel.textContent = `階段 ${animStage} / ${STAGES.length - 1}`;
  }

  function stopAnimTimer() {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
      const btn = document.getElementById("anim-play");
      if (btn) btn.textContent = "▶ 播放";
    }
  }

  document.getElementById("anim-next").addEventListener("click", () => { stopAnimTimer(); showStage(animStage + 1); });
  document.getElementById("anim-prev").addEventListener("click", () => { stopAnimTimer(); showStage(animStage - 1); });
  document.getElementById("anim-reset").addEventListener("click", () => { stopAnimTimer(); showStage(0); });
  document.getElementById("anim-play").addEventListener("click", function () {
    if (animTimer) { stopAnimTimer(); return; }
    if (animStage >= STAGES.length - 1) showStage(0);
    this.textContent = "⏸ 暫停";
    animTimer = setInterval(() => {
      if (animStage >= STAGES.length - 1) { stopAnimTimer(); return; }
      showStage(animStage + 1);
    }, 3200);
  });

  /* ════════ 生活應用：八種工具 ════════ */
  // 顏色約定（全站一致）：支點=橘 #d97706、施力點=紅 #e11d48、抗力點=藍 #2563eb
  function dot(x, y, type) {
    const c = { f: "#d97706", e: "#e11d48", l: "#2563eb" }[type];
    return `<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="#fff" stroke-width="2.5"/>`;
  }

  const APPLY_CASES = [
    {
      name: "蹺蹺板", cls: "equal",
      hint: "點我看它怎麼動！",
      answer: "第一類槓桿：<b>支點在中間</b>。兩邊距離一樣時不省力也不費力，重的人要坐近一點才能平衡。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="蹺蹺板：中央支點，兩端各坐一人，點擊後蹺蹺板傾斜。">
        <line x1="16" y1="140" x2="224" y2="140" stroke="#7a8a6e" stroke-width="3"/>
        <polygon points="120,96 102,138 138,138" fill="#e8a33d" stroke="#a86d14" stroke-width="2"/>
        <g class="moving" style="--move:rotate(9deg);transform-origin:120px 92px;">
          <rect x="28" y="86" width="184" height="10" rx="4" fill="#c8925a" stroke="#8f5f33" stroke-width="1.5"/>
          <circle cx="46" cy="66" r="10" fill="#f4c78f" stroke="#b07b3e" stroke-width="1.5"/>
          <rect x="38" y="74" width="16" height="14" rx="4" fill="#2563eb"/>
          <circle cx="194" cy="66" r="10" fill="#f4c78f" stroke="#b07b3e" stroke-width="1.5"/>
          <rect x="186" y="74" width="16" height="14" rx="4" fill="#e11d48"/>
          ${dot(46, 91, "l")}${dot(194, 91, "e")}
        </g>
        ${dot(120, 96, "f")}
      </svg>`,
    },
    {
      name: "剪刀", cls: "save",
      hint: "點我看它怎麼動！",
      answer: "第一類槓桿：<b>支點（中間螺絲）在中間</b>。紙放在靠近支點的位置剪，抗力臂短，最省力。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="剪刀：中央螺絲為支點，點擊後上方刀片閉合剪紙。">
        <rect x="18" y="70" width="60" height="26" fill="#fef3c7" stroke="#d4b04a" stroke-width="1.5" transform="rotate(-4 48 83)"/>
        <g class="moving" style="--move:rotate(14deg);transform-origin:120px 80px;">
          <polygon points="120,80 26,58 22,68 116,88" fill="#b8c4cf" stroke="#5b6570" stroke-width="1.5"/>
          <path d="M120 80 L196 112 Q214 122 204 134 Q194 142 182 132 L118 90 Z" fill="#e05252" stroke="#9f1d1d" stroke-width="1.5"/>
        </g>
        <polygon points="120,80 26,102 22,92 116,72" fill="#9aa7b3" stroke="#5b6570" stroke-width="1.5"/>
        <path d="M120 80 L196 48 Q214 38 204 26 Q194 18 182 28 L118 70 Z" fill="#e05252" stroke="#9f1d1d" stroke-width="1.5"/>
        ${dot(120, 80, "f")}${dot(196, 108, "e")}${dot(56, 76, "l")}
      </svg>`,
    },
    {
      name: "拔釘鎚", cls: "save",
      hint: "點我看它怎麼動！",
      answer: "第一類槓桿：支點在鎚頭靠著木板的地方。<b>握把長＝施力臂長</b>，輕鬆拔出卡緊的釘子。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="拔釘鎚：鎚頭抵住木板為支點，點擊後手柄扳動拔起釘子。">
        <rect x="10" y="120" width="220" height="24" fill="#d9b98a" stroke="#a3823f" stroke-width="1.5"/>
        <g class="moving" style="--move:rotate(-12deg);transform-origin:78px 118px;">
          <rect x="66" y="24" width="14" height="96" rx="5" fill="#c8925a" stroke="#8f5f33" stroke-width="1.5" transform="rotate(38 78 118)"/>
          <path d="M60 104 Q52 94 60 86 L84 100 Q94 108 86 118 Z" fill="#6b7683" stroke="#3f474f" stroke-width="1.5"/>
          ${dot(150, 52, "e")}
        </g>
        <rect x="52" y="102" width="6" height="20" fill="#8a97a5" stroke="#4b5563" stroke-width="1"/>
        <circle cx="55" cy="100" r="4" fill="#6b7683"/>
        ${dot(78, 118, "f")}${dot(55, 106, "l")}
      </svg>`,
    },
    {
      name: "開瓶器", cls: "save",
      hint: "點我看它怎麼動！",
      answer: "第二類槓桿：<b>抗力點（瓶蓋）在中間</b>，支點在開瓶器前端。抗力臂一定比施力臂短，所以一定省力！",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="開瓶器：前端抵住瓶蓋邊緣為支點，點擊後手柄上抬撬開瓶蓋。">
        <rect x="96" y="60" width="48" height="90" rx="8" fill="#7fb069" stroke="#4f7a3d" stroke-width="2"/>
        <rect x="106" y="44" width="28" height="18" rx="3" fill="#e8e2d0" stroke="#a3823f" stroke-width="1.5"/>
        <g class="moving" style="--move:rotate(-14deg);transform-origin:104px 42px;">
          <rect x="100" y="34" width="110" height="12" rx="6" fill="#8a97a5" stroke="#4b5563" stroke-width="1.5"/>
          ${dot(204, 40, "e")}
        </g>
        ${dot(104, 40, "f")}${dot(134, 46, "l")}
      </svg>`,
    },
    {
      name: "獨輪手推車", cls: "save",
      hint: "點我看它怎麼動！",
      answer: "第二類槓桿：<b>抗力點（貨物）在中間</b>，支點在前面的輪軸。用比貨物重量小的力就能抬起把手。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="獨輪手推車：前輪輪軸為支點，點擊後把手抬起載著貨物。">
        <line x1="10" y1="140" x2="230" y2="140" stroke="#7a8a6e" stroke-width="3"/>
        <g class="moving" style="--move:rotate(-8deg);transform-origin:56px 118px;">
          <path d="M60 96 L150 96 L142 122 L72 122 Z" fill="#c96f2e" stroke="#8a4a1a" stroke-width="2"/>
          <circle cx="105" cy="88" r="14" fill="#9aa3ad" stroke="#525c66" stroke-width="2"/>
          <rect x="146" y="98" width="76" height="8" rx="4" fill="#c8925a" stroke="#8f5f33" stroke-width="1.5" transform="rotate(-10 146 102)"/>
          ${dot(105, 96, "l")}${dot(216, 88, "e")}
        </g>
        <circle cx="56" cy="118" r="20" fill="#454d56"/>
        <circle cx="56" cy="118" r="8" fill="#9aa3ad"/>
        ${dot(56, 118, "f")}
      </svg>`,
    },
    {
      name: "胡桃鉗", cls: "save",
      hint: "點我看它怎麼動！",
      answer: "第二類槓桿：<b>抗力點（核桃）在中間</b>，支點在後端的絞鏈。手在最外端出力，輕鬆夾破硬殼。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="胡桃鉗：後端絞鏈為支點，中間夾著核桃，點擊後上臂壓下夾緊。">
        <g class="moving" style="--move:rotate(10deg);transform-origin:36px 80px;">
          <rect x="34" y="54" width="180" height="13" rx="6" fill="#b08954" stroke="#7c5c2e" stroke-width="1.5" transform="rotate(-8 36 80)"/>
          ${dot(202, 40, "e")}
        </g>
        <rect x="34" y="88" width="180" height="13" rx="6" fill="#b08954" stroke="#7c5c2e" stroke-width="1.5" transform="rotate(8 36 80)"/>
        <circle cx="36" cy="80" r="9" fill="#6b7683" stroke="#3f474f" stroke-width="2"/>
        <circle cx="96" cy="76" r="13" fill="#a97b46" stroke="#6e4a20" stroke-width="2"/>
        <path d="M88 70 Q96 64 104 70" fill="none" stroke="#6e4a20" stroke-width="1.5"/>
        ${dot(36, 80, "f")}${dot(96, 76, "l")}
      </svg>`,
    },
    {
      name: "鑷子", cls: "effort-cost",
      hint: "點我看它怎麼動！",
      answer: "第三類槓桿：<b>施力點（手指壓的地方）在中間</b>，支點在尾端。費力，但尖端移動範圍大、動作精細，適合夾小東西。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="鑷子：尾端相連處為支點，手指壓中段，點擊後尖端夾住小物體。">
        <g class="moving" style="--move:rotate(6deg);transform-origin:40px 80px;">
          <path d="M40 78 L200 46 L204 56 L44 84 Z" fill="#b7c2cc" stroke="#5b6570" stroke-width="1.5"/>
          ${dot(124, 66, "e")}
        </g>
        <path d="M40 82 L200 114 L204 104 L44 76 Z" fill="#9aa7b3" stroke="#5b6570" stroke-width="1.5"/>
        <circle cx="40" cy="80" r="7" fill="#6b7683" stroke="#3f474f" stroke-width="1.5"/>
        <circle cx="206" cy="82" r="8" fill="#f5c04e" stroke="#b78a1e" stroke-width="1.5"/>
        ${dot(40, 80, "f")}${dot(200, 68, "l")}
      </svg>`,
    },
    {
      name: "釣竿", cls: "effort-cost",
      hint: "點我看它怎麼動！",
      answer: "第三類槓桿：後手是支點、<b>前手（施力點）在中間</b>。費力，但竿尖一甩就移動很大距離，能快速把魚拉出水面。",
      svg: `<svg viewBox="0 0 240 160" role="img" aria-label="釣竿：後手為支點、前手施力，點擊後竿尖上揚拉起魚。">
        <path d="M0 128 Q60 118 120 126 T240 124 L240 160 L0 160 Z" fill="#bfdcf5" stroke="none"/>
        <g class="moving" style="--move:rotate(-10deg);transform-origin:36px 118px;">
          <rect x="30" y="112" width="170" height="7" rx="3.5" fill="#8a5a2b" stroke="#5e3c17" stroke-width="1" transform="rotate(-22 36 118)"/>
          <line x1="192" y1="52" x2="196" y2="112" stroke="#64748b" stroke-width="1.5"/>
          <path d="M186 112 Q198 104 208 114 Q198 124 186 118 L180 122 L182 112 Z" fill="#5eead4" stroke="#0f766e" stroke-width="1.5"/>
          ${dot(96, 96, "e")}${dot(192, 56, "l")}
        </g>
        ${dot(36, 118, "f")}
      </svg>`,
    },
  ];

  const applyGrid = document.getElementById("apply-grid");
  APPLY_CASES.forEach((c) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "apply-card";
    card.setAttribute("aria-expanded", "false");
    card.innerHTML = `${c.svg}<h3>${c.name}</h3><p class="apply-hint">${c.hint}</p><p class="apply-answer ${c.cls}">${c.answer}</p>`;
    card.addEventListener("click", () => {
      const on = card.classList.toggle("revealed");
      card.setAttribute("aria-expanded", String(on));
    });
    applyGrid.appendChild(card);
  });

  /* ════════ 闖關測驗 ════════ */
  const QUIZ = [
    {
      q: "槓桿的「三要素」不包含下列哪一項？",
      choices: ["支點", "施力點", "抗力點", "重心點"],
      ans: 3,
      why: "槓桿三要素是支點、施力點、抗力點。「重心」是另一個概念，不是槓桿三要素之一。",
    },
    {
      q: "槓桿平衡時，下列哪一個關係正確？",
      choices: ["施力×施力臂 ＝ 抗力×抗力臂", "施力＋施力臂 ＝ 抗力＋抗力臂", "施力 ＝ 抗力", "施力臂 ＝ 抗力臂"],
      ans: 0,
      why: "平衡條件是兩邊「力×力臂」（力矩）相等，力和力臂本身不一定相等。",
    },
    {
      q: "在實驗器左邊第 2 格掛 6 個砝碼，右邊掛在第 4 格，要幾個砝碼才平衡？",
      choices: ["2 個", "3 個", "4 個", "6 個"],
      ans: 1,
      why: "左邊 6×2＝12，右邊要 12÷4＝3 個砝碼。",
    },
    {
      q: "想做一個「省力」槓桿，條件是什麼？",
      choices: ["施力臂比抗力臂長", "施力臂比抗力臂短", "施力臂和抗力臂一樣長", "支點越高越好"],
      ans: 0,
      why: "施力臂較長時，同樣的力矩只需要比較小的施力，就是省力槓桿。",
    },
    {
      q: "開瓶器的「抗力點」（瓶蓋）位在支點和施力點的中間，這種槓桿有什麼特性？",
      choices: ["一定省力", "一定費力", "不省力也不費力", "無法判斷"],
      ans: 0,
      why: "抗力點在中間時，施力臂（整支長度）一定比抗力臂長，所以一定省力。",
    },
    {
      q: "鑷子是「費力」槓桿，為什麼我們還是喜歡用它？",
      choices: ["因為看起來比較酷", "因為動作精細、尖端移動範圍大", "因為它其實很省力", "因為它比較便宜"],
      ans: 1,
      why: "費力槓桿的好處是「省時省距離」：手指動一點點，尖端就能精準張合，適合夾細小的東西。",
    },
    {
      q: "蹺蹺板上，30 公斤的妹妹坐在離支點 2 公尺處，60 公斤的爸爸要坐在離支點多遠才能平衡？",
      choices: ["0.5 公尺", "1 公尺", "2 公尺", "4 公尺"],
      ans: 1,
      why: "30×2＝60，爸爸這邊 60×距離＝60，所以距離＝1 公尺。越重的人要坐越靠近支點。",
    },
    {
      q: "用剪刀剪厚紙板時，把紙板放在哪裡最省力？",
      choices: ["刀尖（離螺絲最遠）", "刀刃中段", "靠近螺絲（支點）的刀刃根部", "放哪裡都一樣"],
      ans: 2,
      why: "紙板放越靠近支點，抗力臂越短，「抗力×抗力臂」越小，需要的施力就越小。",
    },
    {
      q: "使用省力槓桿撬起重物時，要付出什麼「代價」？",
      choices: ["槓桿容易斷掉", "施力點要移動比較長的距離", "重物會變得更重", "沒有任何代價"],
      ans: 1,
      why: "省力必定費時（費距離）：施力臂長，手移動的距離就比重物抬起的距離長很多。",
    },
    {
      q: "下列哪一種工具的「支點」位在施力點和抗力點的中間？",
      choices: ["開瓶器", "鑷子", "剪刀", "釣竿"],
      ans: 2,
      why: "剪刀的螺絲（支點）在手柄（施力點）和刀刃（抗力點）中間，是第一類槓桿。開瓶器是抗力點在中間；鑷子和釣竿是施力點在中間。",
    },
  ];

  const quizList = document.getElementById("quiz-list");
  const quizScore = document.getElementById("quiz-score");
  let score = 0, answered = 0;

  function renderQuiz() {
    score = 0; answered = 0;
    quizScore.textContent = "目前得分：0 / 10";
    quizList.innerHTML = "";
    QUIZ.forEach((item, qi) => {
      const li = document.createElement("li");
      li.className = "quiz-item";
      const h = document.createElement("h3");
      h.textContent = `第 ${qi + 1} 題　${item.q}`;
      const box = document.createElement("div");
      box.className = "quiz-choices";
      const fb = document.createElement("p");
      fb.className = "quiz-feedback";
      fb.hidden = true;
      item.choices.forEach((c, ci) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-choice";
        btn.textContent = `(${"ABCD"[ci]}) ${c}`;
        btn.addEventListener("click", () => {
          box.querySelectorAll("button").forEach((b) => (b.disabled = true));
          const right = ci === item.ans;
          btn.classList.add(right ? "correct" : "wrong");
          if (!right) box.children[item.ans].classList.add("correct");
          fb.hidden = false;
          fb.className = `quiz-feedback ${right ? "ok" : "no"}`;
          fb.textContent = (right ? "✅ 答對了！" : "❌ 再想想。") + item.why;
          if (right) score++;
          answered++;
          quizScore.textContent = answered === QUIZ.length
            ? `完成！總分：${score} / ${QUIZ.length}${score === QUIZ.length ? "　🏅 恭喜獲得「省力工程師」認證！" : score >= 7 ? "　👍 很棒，再複習錯的題目就滿分了！" : "　💪 回到探索和互動實驗再看一次，一定學得會！"}`
            : `目前得分：${score} / ${QUIZ.length}`;
        });
        box.appendChild(btn);
      });
      li.append(h, box, fb);
      quizList.appendChild(li);
    });
  }
  renderQuiz();
  document.getElementById("quiz-reset").addEventListener("click", renderQuiz);

  /* 初始化（支援 #tab-xxx 或 #panel-xxx 深連結） */
  updateLab();
  showStage(0);
  const hash = location.hash.replace("#", "");
  if (hash) {
    const target = tabs.find((t) => t.id === hash || t.getAttribute("aria-controls") === hash);
    if (target) activateTab(target);
  }
})();
