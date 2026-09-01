/**
 * ?箸瘣鴃璊?繚 閮剖?蝡臬??批?銵冽 (Smart Shower Chair Dashboard)
 * ?舀?單?憭?憓芋?研???皜砌葡瘚SP32-S3 閬?撘?閰???蝡?API ????? */

(function () {
  "use strict";

  // 1. ?身??鞈???(撠? MQTT 閬?葫閰行?靘?
  const SCENARIOS = {
    "normal": {
      name: "甇?虜?尿 (NORMAL)",
      status: "NORMAL",
      reason: "pressure_and_tof_normal",
      reasonZh: "??憯???嚗??寡??Ｗ摰璅???,
      direction: null,
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 420,
      temperature_c: 27.5,
      humidity_percent: 78.0,
      fsr: { front: 1500, back: 1500, left: 1500, right: 1500 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "front-pressure": {
      name: "??? (CAUTION)",
      status: "CAUTION",
      reason: "pressure_shift_only",
      reasonZh: "?尿?嚗?敹?憿舫?銝剜?",
      direction: "front",
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 430,
      temperature_c: 27.6,
      humidity_percent: 78.2,
      fsr: { front: 2800, back: 900, left: 1500, right: 1500 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "left-right-imbalance": {
      name: "撌血銝像銵?(CAUTION)",
      status: "CAUTION",
      reason: "pressure_shift_only",
      reasonZh: "頨恍?撌血?暹?嚗椰?喳??????,
      direction: "left",
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 440,
      temperature_c: 27.5,
      humidity_percent: 77.8,
      fsr: { front: 1500, back: 1500, left: 2600, right: 600 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "distance-abnormal": {
      name: "頝?啣虜 (CAUTION)",
      status: "CAUTION",
      reason: "tof_abnormal_only",
      reasonZh: "ToF ?頝?之嚗?蝣箄??尿?臬敺宏",
      direction: null,
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 900,
      temperature_c: 27.4,
      humidity_percent: 78.5,
      fsr: { front: 1500, back: 1500, left: 1500, right: 1500 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "warning": {
      name: "??+頝霅血? (WARNING)",
      status: "WARNING",
      reason: "pressure_shift_and_tof_abnormal",
      reasonZh: "憯???銝??寞葫頝撣賂????冽??賡◢??,
      direction: "front",
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 700,
      temperature_c: 27.5,
      humidity_percent: 78.0,
      fsr: { front: 2800, back: 900, left: 1800, right: 1200 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "emergency": {
      name: "?湧?皛/頝?(EMERGENCY)",
      status: "EMERGENCY",
      reason: "pressure_and_tof_severely_abnormal",
      reasonZh: "憭?皜砍鈭文??文?嚗??仿瘚仃銝??Ｗ??撣賂??航撌脫??踝?",
      direction: "front",
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: 950,
      temperature_c: 27.5,
      humidity_percent: 78.0,
      fsr: { front: 1900, back: 100, left: 1000, right: 1000 },
      sensor_health: { fsr: true, tof: true, environment: true }
    },
    "sensor-offline": {
      name: "?葫?冽???(SENSOR_ERROR)",
      status: "SENSOR_ERROR",
      reason: "required_sensor_unavailable",
      reasonZh: "敹??葫??(FSR/ToF) 閮?銝剜??憯?,
      direction: null,
      device_id: "chair_01",
      connection: "ONLINE",
      distance_mm: null,
      temperature_c: null,
      humidity_percent: null,
      fsr: { front: null, back: null, left: null, right: null },
      sensor_health: { fsr: false, tof: false, environment: false }
    },
    "offline": {
      name: "閮剖??Ｙ? (OFFLINE)",
      status: "OFFLINE",
      reason: "heartbeat_timeout",
      reasonZh: "頞? 5 蝘?嗅 ESP32-S3 敹歲??皜砍???,
      direction: null,
      device_id: "chair_01",
      connection: "OFFLINE",
      distance_mm: 420,
      temperature_c: 27.5,
      humidity_percent: 78.0,
      fsr: { front: 1500, back: 1500, left: 1500, right: 1500 },
      sensor_health: { fsr: true, tof: true, environment: true }
    }
  };

  // ??蕃霅臬???  const STATUS_DICT = {
    NORMAL: { title: "甇?虜???(NORMAL)", class: "normal", bannerDesc: "雿輻??憪踹像蝛抬???憯????﹛嚗??寡??Ｚ??啣??葫?券?雿憟賬? },
    CAUTION: { title: "?閬???(CAUTION)", class: "caution", bannerDesc: "?葫?典皜砍憪踹敺桀??宏?葫頝凝撟??堆?隢憿扯????? },
    WARNING: { title: "摰霅血? (WARNING)", class: "warning", bannerDesc: "??憯????寡??Ｗ????Ｗ皞?瑼鳴??航?喳?皛???憪蹂?蝛抬?" },
    EMERGENCY: { title: "蝺亦?瘜?(EMERGENCY)", class: "emergency", bannerDesc: "憭?皜砍鈭文??文??之?啣虜嚗蝙?刻?賢歇蝬??賣??Ｘ?頝?隢??喟Ⅱ隤?" },
    SENSOR_ERROR: { title: "?葫?冽???(SENSOR_ERROR)", class: "error", bannerDesc: "蝖祇??辣??蝺??啣虜嚗?瑼Ｖ耨璊? FSR ??ToF 皜祈?璅∠??? },
    OFFLINE: { title: "閮剖?撌脤蝺?(OFFLINE)", class: "offline", bannerDesc: "閮剖???銝剜嚗????敺?蝑?皜祈???隢炎??Wi-Fi ?皞? }
  };

  const REASON_ZH = {
    pressure_and_tof_normal: "憯??葫頝??典??典皞??",
    pressure_shift_only: "?菜葫?啣?憪踹???憿臬?蝘?,
    tof_abnormal_only: "? ToF 皜祈??詨澆??Ｘ迤撣訾?????,
    pressure_shift_and_tof_abnormal: "憯???銝??寞葫頝撣賂??撮皛宏",
    pressure_and_tof_severely_abnormal: "?踹?璆萄漲憭梯﹛銝??Ｗ??憭?(?航皛)",
    required_sensor_unavailable: "敹??葫?辣?桀??⊥?????,
    heartbeat_timeout: "頞??Ｙ??瑼餅?嗅?葫敹歲撠?"
  };

  const DIRECTION_ZH = {
    front: "? (Front)",
    back: "敺趕 (Back)",
    left: "撌血 (Left)",
    right: "?喳 (Right)",
    null: "撟喟帘?∪?蝘?
  };

  // ??恣??  let currentScenarioKey = "normal";
  let activeState = JSON.parse(JSON.stringify(SCENARIOS["normal"]));
  let sequenceNumber = 125;
  let isLiveStreaming = true;
  let streamTimer = null;
  let apiPollingTimer = null;
  let isApiMode = false;

  // DOM ?豢??典翰??  const $ = (id) => document.getElementById(id);

  function formatTime(date) {
    const d = date || new Date();
    return d.toTimeString().split(" ")[0];
  }

  // 2. 閬?撘? (璅⊥ status-engine / rules.py 閰??摩)
  function evaluateTelemetry(data) {
    const health = data.sensor_health;
    if (!health.fsr || !health.tof) {
      return {
        status: "SENSOR_ERROR",
        reason: "required_sensor_unavailable",
        direction: null,
        evidence: { sensor_health: health }
      };
    }

    const fsr = data.fsr;
    const f = fsr.front || 0, b = fsr.back || 0, l = fsr.left || 0, r = fsr.right || 0;
    const total = f + b + l + r;
    const frontRatio = (f + b) > 0 ? f / (f + b) : 0.5;
    const backRatio = 1.0 - frontRatio;
    const leftRatio = (l + r) > 0 ? l / (l + r) : 0.5;
    const rightRatio = 1.0 - leftRatio;

    const ratios = { front: frontRatio, back: backRatio, left: leftRatio, right: rightRatio };
    let dominantDirection = "front";
    let maxRatio = 0;
    for (const [dir, val] of Object.entries(ratios)) {
      if (val > maxRatio) {
        maxRatio = val;
        dominantDirection = dir;
      }
    }

    const distance = data.distance_mm || 0;
    const isPressureEmergency = maxRatio >= 0.90 || total <= 800;
    const isPressureWarning = maxRatio >= 0.75;
    const isPressureCaution = maxRatio >= 0.65;
    const isTofEmergency = distance >= 800;
    const isTofWarning = distance >= 650;

    let status = "NORMAL";
    let reason = "pressure_and_tof_normal";

    if ((isPressureEmergency || isPressureWarning) && isTofEmergency) {
      status = "EMERGENCY";
      reason = "pressure_and_tof_severely_abnormal";
    } else if (isPressureWarning && isTofWarning) {
      status = "WARNING";
      reason = "pressure_shift_and_tof_abnormal";
    } else if (isPressureCaution) {
      status = "CAUTION";
      reason = "pressure_shift_only";
    } else if (isTofWarning) {
      status = "CAUTION";
      reason = "tof_abnormal_only";
    } else {
      status = "NORMAL";
      reason = "pressure_and_tof_normal";
    }

    return {
      status: status,
      reason: reason,
      direction: dominantDirection,
      evidence: {
        total_pressure: total,
        max_ratio: maxRatio,
        front_ratio: frontRatio,
        left_ratio: leftRatio,
        distance_mm: distance
      }
    };
  }

  // 3. UI 皜脫?撘?
  function renderDashboard(state) {
    const timeStr = formatTime();
    $("last-updated").textContent = timeStr;
    $("seq-counter").textContent = sequenceNumber;
    $("banner-timestamp").textContent = timeStr;

    // ?????摰?    const isOffline = state.connection === "OFFLINE";
    const connStatusText = isOffline ? "閮剖?撌脤蝺?(OFFLINE)" : "閮剖??函? (ONLINE)";
    $("conn-status-text").textContent = connStatusText;
    $("conn-dot").className = "dot " + (isOffline ? "dot-offline" : "dot-online");

    // ???蝝?摰?    let currentStatus = isOffline ? "OFFLINE" : state.status;
    const meta = STATUS_DICT[currentStatus] || STATUS_DICT["NORMAL"];

    // ?璈怠? (Banner)
    const banner = $("status-banner");
    banner.className = "status-banner banner-" + meta.class;
    $("banner-title").textContent = meta.title;
    $("banner-code").textContent = currentStatus;
    $("banner-desc").textContent = state.reasonZh || meta.bannerDesc;
    $("banner-icon").textContent = currentStatus === "NORMAL" ? "?? : currentStatus === "OFFLINE" ? "?? : "!";

    // Hero ????    $("hero-status-title").textContent = meta.title;
    $("hero-status-title").className = "status-text-" + meta.class;
    $("hero-reason-text").textContent = state.reasonZh || REASON_ZH[state.reason] || state.reason;
    $("hero-reason-code").textContent = "(" + state.reason + ")";

    // Status Orb
    const orb = $("status-orb");
    orb.className = "status-orb orb-" + meta.class;
    $("orb-icon").textContent = currentStatus === "NORMAL" ? "OK" : currentStatus === "EMERGENCY" ? "SOS" : "!";

    // Evidence & ???孵?
    $("ev-direction").textContent = DIRECTION_ZH[state.direction] || "撟喟帘?∪?蝘?;

    const fsr = state.fsr || {};
    const totalP = (fsr.front || 0) + (fsr.back || 0) + (fsr.left || 0) + (fsr.right || 0);
    $("ev-total-pressure").textContent = (state.sensor_health && state.sensor_health.fsr) ? totalP + " raw" : "?⊥?";

    // FSR 4暺?潸??脣漲璇?    ["front", "back", "left", "right"].forEach(pos => {
      const val = fsr[pos];
      const valText = val !== null && val !== undefined ? val : "??;
      const pct = val !== null && val !== undefined ? Math.min(100, Math.round((val / 4095) * 100)) : 0;

      $(`fsr-val-${pos}`).textContent = valText;
      $(`adc-${pos}`).textContent = valText + (val !== null ? " raw" : "");
      $(`fsr-bar-${pos}`).style.width = pct + "%";

      const share = totalP > 0 && val !== null ? ((val / totalP) * 100).toFixed(1) + "%" : "??;
      $(`pct-${pos}`).textContent = share;
    });

    // ?? / 撌血??璇?    const f = fsr.front || 0, b = fsr.back || 0, l = fsr.left || 0, r = fsr.right || 0;
    const fbTotal = f + b;
    const lrTotal = l + r;

    const fRatio = fbTotal > 0 ? (f / fbTotal) * 100 : 50;
    const bRatio = 100 - fRatio;
    const lRatio = lrTotal > 0 ? (l / lrTotal) * 100 : 50;
    const rRatio = 100 - lRatio;

    $("ratio-fb-text").textContent = `${fRatio.toFixed(1)}% : ${bRatio.toFixed(1)}%`;
    $("ratio-fb-fill").style.width = fRatio + "%";

    $("ratio-lr-text").textContent = `${lRatio.toFixed(1)}% : ${rRatio.toFixed(1)}%`;
    $("ratio-lr-fill").style.width = lRatio + "%";

    const maxRatioVal = Math.max(fRatio, bRatio, lRatio, rRatio);
    $("ev-max-ratio").textContent = (state.sensor_health && state.sensor_health.fsr) ? maxRatioVal.toFixed(1) + "%" : "??;

    // ??暺?(CoP) 閬死摨扳?
    // X 頠? 0 (撌? ~ 100 (??
    // Y 頠? 0 (敺? ~ 100 (??
    const copDot = $("cop-dot");
    const copX = Math.max(15, Math.min(85, (rRatio))); // ?喲?憭批? X 敺??    const copY = Math.max(15, Math.min(85, (fRatio))); // ??憭批? Y 敺??(銝)
    copDot.style.left = copX + "%";
    copDot.style.top = copY + "%";

    // ToF 頝?葫??    const dist = state.distance_mm;
    $("metric-distance").textContent = dist !== null && dist !== undefined ? dist : "??;
    const tofGaugePointer = $("tof-indicator");
    if (dist !== null && dist !== undefined) {
      const clampedDist = Math.max(0, Math.min(1200, dist));
      const tofPct = (clampedDist / 1200) * 100;
      tofGaugePointer.style.left = tofPct + "%";
      tofGaugePointer.style.display = "block";

      if (dist < 550) {
        $("ev-tof-level").textContent = "摰甇?虜";
        $("ev-tof-level").className = "ev-val text-success";
        $("distance-status-desc").textContent = "?頝?璅?摰銋?蝭? (400 ~ 500 mm)";
      } else if (dist < 750) {
        $("ev-tof-level").textContent = "頛漲?? (瘜冽?)";
        $("ev-tof-level").className = "ev-val text-caution";
        $("distance-status-desc").textContent = "?皜祈??亙凝?之嚗釣??血??????芸?";
      } else {
        $("ev-tof-level").textContent = "?湧??啣虜 (霅血?)";
        $("ev-tof-level").className = "ev-val text-emergency";
        $("distance-status-desc").textContent = "?皜祈??湧?頞?嚗蝙?刻?賢歇?ａ?摨扳?????;
      }
    } else {
      tofGaugePointer.style.display = "none";
      $("ev-tof-level").textContent = "?∟???;
      $("distance-status-desc").textContent = "ToF 皜祈?璅∠?閮??箏仃????;
    }

    // 皞急?摨?    $("metric-temp").textContent = state.temperature_c !== null ? Number(state.temperature_c).toFixed(1) : "??;
    $("metric-humidity").textContent = state.humidity_percent !== null ? Number(state.humidity_percent).toFixed(1) : "??;

    // ?葫?典摨瑞???蝐?    setHealthBadge("health-fsr", state.sensor_health && state.sensor_health.fsr, "4暺?FSR 璅∠?甇?虜", "FSR 霈?撣?);
    setHealthBadge("health-tof", state.sensor_health && state.sensor_health.tof, "ToF 皜祈?甇?虜", "ToF ??銝剜");
    setHealthBadge("health-env", state.sensor_health && state.sensor_health.environment, "?啣??葫甇?虜", "?啣??葫?啣虜");
  }

  function setHealthBadge(id, isOk, okText, errText) {
    const el = $(id);
    if (isOk === true) {
      el.textContent = okText;
      el.className = "chip chip-success";
    } else if (isOk === false) {
      el.textContent = errText;
      el.className = "chip chip-danger";
    } else {
      el.textContent = "?芸皜?;
      el.className = "chip chip-warning";
    }
  }

  // 4. 鈭辣甇瑞?閮?
  function logEvent(status, title, desc) {
    const list = $("event-log-list");
    const meta = STATUS_DICT[status] || STATUS_DICT["NORMAL"];
    const li = document.createElement("li");
    li.className = `event-row event-row-${meta.class}`;
    li.innerHTML = `
      <span class="event-badge badge-${meta.class}">${status}</span>
      <div class="event-main">
        <strong>${title}</strong>
        <p class="event-desc">${desc}</p>
      </div>
      <span class="event-time font-mono">${formatTime()}</span>
    `;
    list.insertBefore(li, list.firstChild);

    // ?憭???12 蝑?    while (list.children.length > 12) {
      list.removeChild(list.lastChild);
    }
  }

  // 5. ??璅⊥閮??潛???(?凝撠璈??
  function applySensorJitter(baseState) {
    if (baseState.status === "SENSOR_ERROR" || baseState.connection === "OFFLINE") {
      return baseState;
    }
    const cloned = JSON.parse(JSON.stringify(baseState));
    sequenceNumber++;

    // FSR 頛凝?? (簣25 raw)
    for (const key of Object.keys(cloned.fsr)) {
      if (cloned.fsr[key] !== null) {
        const noise = Math.floor((Math.random() - 0.5) * 50);
        cloned.fsr[key] = Math.max(50, Math.min(4000, cloned.fsr[key] + noise));
      }
    }

    // ToF 頛凝?? (簣8 mm)
    if (cloned.distance_mm !== null) {
      const noise = Math.floor((Math.random() - 0.5) * 16);
      cloned.distance_mm = Math.max(100, cloned.distance_mm + noise);
    }

    // 皞急?摨西?敺桀凝??    if (cloned.temperature_c !== null) {
      cloned.temperature_c = Number((cloned.temperature_c + (Math.random() - 0.5) * 0.1).toFixed(1));
    }
    if (cloned.humidity_percent !== null) {
      cloned.humidity_percent = Number((cloned.humidity_percent + (Math.random() - 0.5) * 0.2).toFixed(1));
    }

    // ?憟閬???
    const evalRes = evaluateTelemetry(cloned);
    cloned.status = evalRes.status;
    cloned.reason = evalRes.reason;
    cloned.direction = evalRes.direction;
    cloned.reasonZh = REASON_ZH[evalRes.reason];

    return cloned;
  }

  // 6. ????
  function setScenario(key) {
    currentScenarioKey = key;
    activeState = JSON.parse(JSON.stringify(SCENARIOS[key]));
    sequenceNumber++;

    // ?湔??璅??
    document.querySelectorAll(".btn-scenario").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-scenario") === key);
    });

    renderDashboard(activeState);
    logEvent(activeState.status, activeState.name, activeState.reasonZh || activeState.reason);
  }

  // 7. ??銝脫?摰???  function startLiveStream() {
    if (streamTimer) clearInterval(streamTimer);
    streamTimer = setInterval(() => {
      if (!isLiveStreaming || isApiMode) return;
      activeState = applySensorJitter(activeState);
      renderDashboard(activeState);
    }, 500);
  }

  // 8. ??敺垢 API 璅∪? (?舫)
  async function pollBackendApi() {
    const baseUrl = $("api-base-url").value.trim().replace(/\/$/, "");
    try {
      const [latestRes, statusRes] = await Promise.all([
        fetch(baseUrl + "/api/latest?device_id=chair_01").then(r => r.json()),
        fetch(baseUrl + "/api/status?device_id=chair_01").then(r => r.json())
      ]);

      if (latestRes.ok && latestRes.data) {
        const d = latestRes.data;
        const telemetry = d.telemetry || {};
        const evalRes = evaluateTelemetry(telemetry);

        activeState = {
          name: "API ?單??葫",
          status: d.status || evalRes.status,
          reason: d.reason || evalRes.reason,
          reasonZh: REASON_ZH[d.reason] || d.reason,
          direction: d.direction || evalRes.direction,
          device_id: d.device_id || "chair_01",
          connection: (statusRes.data && statusRes.data[0] && statusRes.data[0].connection_status) || "ONLINE",
          distance_mm: telemetry.distance_mm,
          temperature_c: telemetry.temperature_c,
          humidity_percent: telemetry.humidity_percent,
          fsr: telemetry.fsr || { front: 0, back: 0, left: 0, right: 0 },
          sensor_health: telemetry.sensor_health || { fsr: true, tof: true, environment: true }
        };
        sequenceNumber = telemetry.sequence || sequenceNumber + 1;
        renderDashboard(activeState);
        $("mode-badge").textContent = "API ???璅∪?";
        $("mode-badge").style.borderColor = "var(--status-normal)";
      }
    } catch (err) {
      console.warn("API poll failed, retaining last state", err);
    }
  }

  // 9. 鈭辣蝬???憪?
  function init() {
    // 蝬?????
    document.querySelectorAll(".btn-scenario").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-scenario");
        setScenario(key);
      });
    });

    // 蝬???銝脫???
    $("live-stream-toggle").addEventListener("change", (e) => {
      isLiveStreaming = e.target.checked;
    });

    // 蝬?皜閮???
    $("btn-clear-events").addEventListener("click", () => {
      $("event-log-list").innerHTML = "";
    });

    // 蝬? API ???????
    $("btn-connect-api").addEventListener("click", async () => {
      const btn = $("btn-connect-api");
      btn.textContent = "???銝?..";
      const baseUrl = $("api-base-url").value.trim().replace(/\/$/, "");
      try {
        const health = await fetch(baseUrl + "/api/health").then(r => r.json());
        if (health.ok) {
          isApiMode = true;
          btn.textContent = "??撌脤? API";
          $("mode-badge").textContent = "API ???銝?;
          if (apiPollingTimer) clearInterval(apiPollingTimer);
          apiPollingTimer = setInterval(pollBackendApi, 1000);
          pollBackendApi();
          logEvent("NORMAL", "撌脫???敺垢 API", "甇??蝥 " + baseUrl + " 頛芾岷??唳?皜砍???);
        } else {
          throw new Error("API 銝摨?);
        }
      } catch (err) {
        btn.textContent = "???憭望? (蝬剜?璅⊥)";
        logEvent("SENSOR_ERROR", "敺垢 API ???憭望?", "隢Ⅱ隤璈?API (127.0.0.1:8000) ?臬??嚗?雁?芋?祆芋撘?);
        setTimeout(() => { btn.textContent = "????API ???"; }, 2500);
      }
    });

    // ?活頛
    renderDashboard(activeState);
    logEvent("NORMAL", "蝟餌絞???停蝺?, "頛?身甇?虜?尿嚗?憪?500ms ?單??葫銝脫?");
    startLiveStream();
  }

  // ???蝔?
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
