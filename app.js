/**
 * 智慧洗澡椅 · 設備端即時監控儀表板 (Smart Shower Chair Dashboard)
 * 支援即時多情境模擬、動態感測串流、ESP32-S3 規則引擎評定與後端 API 連線。
 */

(function () {
  "use strict";

  // 1. 預設情境資料集 (對齊 MQTT 規格與測試案例)
  const SCENARIOS = {
    "normal": {
      name: "正常坐姿 (NORMAL)",
      status: "NORMAL",
      reason: "pressure_and_tof_normal",
      reasonZh: "四點壓力均等，前方距離在安全標準內",
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
      name: "前側偏壓 (CAUTION)",
      status: "CAUTION",
      reason: "pressure_shift_only",
      reasonZh: "坐姿前傾，重心明顯集中於前側",
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
      name: "左右不平衡 (CAUTION)",
      status: "CAUTION",
      reason: "pressure_shift_only",
      reasonZh: "身體左側傾斜，左右受力嚴重不均",
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
      name: "距離異常 (CAUTION)",
      status: "CAUTION",
      reason: "tof_abnormal_only",
      reasonZh: "ToF 前方距離過大，請確認坐姿是否後移",
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
      name: "偏壓+距離警告 (WARNING)",
      status: "WARNING",
      reason: "pressure_shift_and_tof_abnormal",
      reasonZh: "壓力偏斜且前方測距異常，有潛在滑落風險",
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
      name: "嚴重滑落/跌倒 (EMERGENCY)",
      status: "EMERGENCY",
      reason: "pressure_and_tof_severely_abnormal",
      reasonZh: "多感測器交叉判定：壓力急遽流失且距離劇烈異常，可能已滑落！",
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
      name: "感測器故障 (SENSOR_ERROR)",
      status: "SENSOR_ERROR",
      reason: "required_sensor_unavailable",
      reasonZh: "必要感測器 (FSR/ToF) 訊號中斷或損壞",
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
      name: "設備離線 (OFFLINE)",
      status: "OFFLINE",
      reason: "heartbeat_timeout",
      reasonZh: "超過 5 秒未收到 ESP32-S3 心跳與感測封包",
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

  // 狀態翻譯對照
  const STATUS_DICT = {
    NORMAL: { title: "正常狀態 (NORMAL)", class: "normal", bannerDesc: "使用者坐姿平穩，四點壓力分佈均衡，前方距離與環境感測器運作良好。" },
    CAUTION: { title: "需要留意 (CAUTION)", class: "caution", bannerDesc: "感測器偵測到姿勢微幅偏移或測距微幅變異，請照顧者稍加留意。" },
    WARNING: { title: "安全警告 (WARNING)", class: "warning", bannerDesc: "四點壓力與前方距離同時偏離基準門檻，可能即將滑動或坐姿不穩！" },
    EMERGENCY: { title: "緊急狀況 (EMERGENCY)", class: "emergency", bannerDesc: "多感測器交叉判定重大異常！使用者可能已經滑落椅面或跌倒，請立即確認！" },
    SENSOR_ERROR: { title: "感測器故障 (SENSOR_ERROR)", class: "error", bannerDesc: "硬體元件或排線通訊異常，請檢修椅墊 FSR 或 ToF 測距模組。" },
    OFFLINE: { title: "設備已離線 (OFFLINE)", class: "offline", bannerDesc: "設備通訊中斷，目前保留最後一筆遙測資料；請檢查 Wi-Fi 與電源。" }
  };

  const REASON_ZH = {
    pressure_and_tof_normal: "壓力與測距均在安全基準範圍內",
    pressure_shift_only: "偵測到坐姿壓力明顯偏移",
    tof_abnormal_only: "前方 ToF 測距數值偏離正常乘坐距離",
    pressure_shift_and_tof_abnormal: "壓力偏斜且前方測距異常，疑似滑移",
    pressure_and_tof_severely_abnormal: "承壓極度失衡且距離劇烈擴大 (可能滑落)",
    required_sensor_unavailable: "必要感測元件目前無有效資料",
    heartbeat_timeout: "超過離線門檻未收到感測心跳封包"
  };

  const DIRECTION_ZH = {
    front: "前傾 (Front)",
    back: "後仰 (Back)",
    left: "左傾 (Left)",
    right: "右傾 (Right)",
    null: "平穩無偏移"
  };

  // 狀態管理
  let currentScenarioKey = "normal";
  let activeState = JSON.parse(JSON.stringify(SCENARIOS["normal"]));
  let sequenceNumber = 125;
  let isLiveStreaming = true;
  let streamTimer = null;
  let apiPollingTimer = null;
  let isApiMode = false;

  // DOM 選擇器快取
  const $ = (id) => document.getElementById(id);

  function formatTime(date) {
    const d = date || new Date();
    return d.toTimeString().split(" ")[0];
  }

  // 2. 規則引擎 (模擬 status-engine / rules.py 評定邏輯)
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

  // 3. UI 渲染引擎
  function renderDashboard(state) {
    const timeStr = formatTime();
    $("last-updated").textContent = timeStr;
    $("seq-counter").textContent = sequenceNumber;
    $("banner-timestamp").textContent = timeStr;

    // 連線狀態判定
    const isOffline = state.connection === "OFFLINE";
    const connStatusText = isOffline ? "設備已離線 (OFFLINE)" : "設備在線 (ONLINE)";
    $("conn-status-text").textContent = connStatusText;
    $("conn-dot").className = "dot " + (isOffline ? "dot-offline" : "dot-online");

    // 狀態等級評定
    let currentStatus = isOffline ? "OFFLINE" : state.status;
    const meta = STATUS_DICT[currentStatus] || STATUS_DICT["NORMAL"];

    // 頂部橫幅 (Banner)
    const banner = $("status-banner");
    banner.className = "status-banner banner-" + meta.class;
    $("banner-title").textContent = meta.title;
    $("banner-code").textContent = currentStatus;
    $("banner-desc").textContent = state.reasonZh || meta.bannerDesc;
    $("banner-icon").textContent = currentStatus === "NORMAL" ? "✓" : currentStatus === "OFFLINE" ? "✕" : "!";

    // Hero 狀態卡片
    $("hero-status-title").textContent = meta.title;
    $("hero-status-title").className = "status-text-" + meta.class;
    $("hero-reason-text").textContent = state.reasonZh || REASON_ZH[state.reason] || state.reason;
    $("hero-reason-code").textContent = "(" + state.reason + ")";

    // Status Orb
    const orb = $("status-orb");
    orb.className = "status-orb orb-" + meta.class;
    $("orb-icon").textContent = currentStatus === "NORMAL" ? "OK" : currentStatus === "EMERGENCY" ? "SOS" : "!";

    // Evidence & 重心方向
    $("ev-direction").textContent = DIRECTION_ZH[state.direction] || "平穩無偏移";

    const fsr = state.fsr || {};
    const totalP = (fsr.front || 0) + (fsr.back || 0) + (fsr.left || 0) + (fsr.right || 0);
    $("ev-total-pressure").textContent = (state.sensor_health && state.sensor_health.fsr) ? totalP + " raw" : "無效";

    // FSR 4點數值與進度條
    ["front", "back", "left", "right"].forEach(pos => {
      const val = fsr[pos];
      const valText = val !== null && val !== undefined ? val : "—";
      const pct = val !== null && val !== undefined ? Math.min(100, Math.round((val / 4095) * 100)) : 0;

      $(`fsr-val-${pos}`).textContent = valText;
      $(`adc-${pos}`).textContent = valText + (val !== null ? " raw" : "");
      $(`fsr-bar-${pos}`).style.width = pct + "%";

      const share = totalP > 0 && val !== null ? ((val / totalP) * 100).toFixed(1) + "%" : "—";
      $(`pct-${pos}`).textContent = share;
    });

    // 前後 / 左右配比條
    const f = fsr.front || 0, b = fsr.back || 0, l = fsr.left || 0, r = fsr.right || 0;
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
    $("ev-max-ratio").textContent = (state.sensor_health && state.sensor_health.fsr) ? maxRatioVal.toFixed(1) + "%" : "—";

    // 重心點 (CoP) 視覺座標
    const copDot = $("cop-dot");
    const copX = Math.max(15, Math.min(85, (rRatio))); // 右邊大則 X 往右
    const copY = Math.max(15, Math.min(85, (fRatio))); // 前邊大則 Y 往前
    copDot.style.left = copX + "%";
    copDot.style.top = copY + "%";

    // ToF 距離感測器
    const dist = state.distance_mm;
    $("metric-distance").textContent = dist !== null && dist !== undefined ? dist : "—";
    const tofGaugePointer = $("tof-indicator");
    if (dist !== null && dist !== undefined) {
      const clampedDist = Math.max(0, Math.min(1200, dist));
      const tofPct = (clampedDist / 1200) * 100;
      tofGaugePointer.style.left = tofPct + "%";
      tofGaugePointer.style.display = "block";

      if (dist < 550) {
        $("ev-tof-level").textContent = "安全正常";
        $("ev-tof-level").className = "ev-val text-success";
        $("distance-status-desc").textContent = "前方距離處於標準安全乘坐範圍 (400 ~ 500 mm)";
      } else if (dist < 750) {
        $("ev-tof-level").textContent = "輕度偏遠 (注意)";
        $("ev-tof-level").className = "ev-val text-caution";
        $("distance-status-desc").textContent = "前方測距略微偏大，注意是否往前或向後挪動";
      } else {
        $("ev-tof-level").textContent = "嚴重異常 (警告)";
        $("ev-tof-level").className = "ev-val text-emergency";
        $("distance-status-desc").textContent = "前方測距嚴重超標！使用者可能已離開座椅或滑落";
      }
    } else {
      tofGaugePointer.style.display = "none";
      $("ev-tof-level").textContent = "無訊號";
      $("distance-status-desc").textContent = "ToF 測距模組訊號遺失或關閉";
    }

    // 溫濕度
    $("metric-temp").textContent = state.temperature_c !== null ? Number(state.temperature_c).toFixed(1) : "—";
    $("metric-humidity").textContent = state.humidity_percent !== null ? Number(state.humidity_percent).toFixed(1) : "—";

    // 感測器健康狀態標籤
    setHealthBadge("health-fsr", state.sensor_health && state.sensor_health.fsr, "4點 FSR 模組正常", "FSR 讀取異常");
    setHealthBadge("health-tof", state.sensor_health && state.sensor_health.tof, "ToF 測距正常", "ToF 故障中斷");
    setHealthBadge("health-env", state.sensor_health && state.sensor_health.environment, "環境感測正常", "環境感測異常");
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
      el.textContent = "未偵測";
      el.className = "chip chip-warning";
    }
  }

  // 4. 事件歷程記錄
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

    // 最多保留 12 筆
    while (list.children.length > 12) {
      list.removeChild(list.lastChild);
    }
  }

  // 5. 動態模擬訊號發生器 (加微小隨機擾動)
  function applySensorJitter(baseState) {
    if (baseState.status === "SENSOR_ERROR" || baseState.connection === "OFFLINE") {
      return baseState;
    }
    const cloned = JSON.parse(JSON.stringify(baseState));
    sequenceNumber++;

    // FSR 輕微晃動 (±25 raw)
    for (const key of Object.keys(cloned.fsr)) {
      if (cloned.fsr[key] !== null) {
        const noise = Math.floor((Math.random() - 0.5) * 50);
        cloned.fsr[key] = Math.max(50, Math.min(4000, cloned.fsr[key] + noise));
      }
    }

    // ToF 輕微晃動 (±8 mm)
    if (cloned.distance_mm !== null) {
      const noise = Math.floor((Math.random() - 0.5) * 16);
      cloned.distance_mm = Math.max(100, cloned.distance_mm + noise);
    }

    // 溫濕度輕微微動
    if (cloned.temperature_c !== null) {
      cloned.temperature_c = Number((cloned.temperature_c + (Math.random() - 0.5) * 0.1).toFixed(1));
    }
    if (cloned.humidity_percent !== null) {
      cloned.humidity_percent = Number((cloned.humidity_percent + (Math.random() - 0.5) * 0.2).toFixed(1));
    }

    // 重新套用規則分類
    const evalRes = evaluateTelemetry(cloned);
    cloned.status = evalRes.status;
    cloned.reason = evalRes.reason;
    cloned.direction = evalRes.direction;
    cloned.reasonZh = REASON_ZH[evalRes.reason];

    return cloned;
  }

  // 6. 情境切換
  function setScenario(key) {
    currentScenarioKey = key;
    activeState = JSON.parse(JSON.stringify(SCENARIOS[key]));
    sequenceNumber++;

    // 更新按鈕樣式
    document.querySelectorAll(".btn-scenario").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-scenario") === key);
    });

    renderDashboard(activeState);
    logEvent(activeState.status, activeState.name, activeState.reasonZh || activeState.reason);
  }

  // 7. 動態串流定時器
  function startLiveStream() {
    if (streamTimer) clearInterval(streamTimer);
    streamTimer = setInterval(() => {
      if (!isLiveStreaming || isApiMode) return;
      activeState = applySensorJitter(activeState);
      renderDashboard(activeState);
    }, 500);
  }

  // 8. 連接後端 API 模式 (可選)
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
          name: "API 即時遙測",
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
        $("mode-badge").textContent = "API 連線模式";
        $("mode-badge").style.borderColor = "var(--status-normal)";
      }
    } catch (err) {
      console.warn("API poll failed, retaining last state", err);
    }
  }

  // 9. 事件綁定與初始化
  function init() {
    // 綁定情境按鈕
    document.querySelectorAll(".btn-scenario").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-scenario");
        setScenario(key);
      });
    });

    // 綁定動態串流開關
    $("live-stream-toggle").addEventListener("change", (e) => {
      isLiveStreaming = e.target.checked;
    });

    // 綁定清除記錄按鈕
    $("btn-clear-events").addEventListener("click", () => {
      $("event-log-list").innerHTML = "";
    });

    // 綁定 API 連線切換按鈕
    $("btn-connect-api").addEventListener("click", async () => {
      const btn = $("btn-connect-api");
      btn.textContent = "連線中...";
      const baseUrl = $("api-base-url").value.trim().replace(/\/$/, "");
      try {
        const health = await fetch(baseUrl + "/api/health").then(r => r.json());
        if (health.ok) {
          isApiMode = true;
          btn.textContent = "✓ 已連接 API";
          $("mode-badge").textContent = "API 連線中";
          if (apiPollingTimer) clearInterval(apiPollingTimer);
          apiPollingTimer = setInterval(pollBackendApi, 1000);
          pollBackendApi();
          logEvent("NORMAL", "已成功連接後端 API", "正持續自 " + baseUrl + " 輪詢最新感測封包");
        } else {
          throw new Error("API 不健康");
        }
      } catch (err) {
        btn.textContent = "連線失敗 (維持模擬)";
        logEvent("SENSOR_ERROR", "後端 API 連線失敗", "請確認本機 API (127.0.0.1:8000) 是否啟動，目前維持模擬模式。");
        setTimeout(() => { btn.textContent = "切換至 API 連線"; }, 2500);
      }
    });

    // 初次載入
    renderDashboard(activeState);
    logEvent("NORMAL", "系統初始化就緒", "載入預設正常坐姿，開始 500ms 即時遙測串流");
    startLiveStream();
  }

  // 啟動應用程式
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
