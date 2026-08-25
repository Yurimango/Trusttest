// ==============================
// 诚信核查插件工具包 - popup.js
// 负责：读取网站清单、管理进度、绑定按钮、保存项目信息
// ==============================

// ---------- DOM 元素 ----------
const projectNameInput = document.getElementById("projectName");
const subjectNameInput = document.getElementById("subjectName");

const currentSiteNameEl = document.getElementById("currentSiteName");
const currentSiteUrlEl = document.getElementById("currentSiteUrl");
const progressTextEl = document.getElementById("progressText");
const statusEl = document.getElementById("status");
const siteListSourceEl = document.getElementById("siteListSource");
const customSitesTextArea = document.getElementById("customSitesText");

const openCurrentBtn = document.getElementById("openCurrentBtn");
const openPreviousBtn = document.getElementById("openPreviousBtn");
const openNextBtn = document.getElementById("openNextBtn");
const copySubjectBtn = document.getElementById("copySubjectBtn");
const newProjectBtn = document.getElementById("newProjectBtn");
const captureBtn = document.getElementById("captureBtn");
const skipBtn = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const saveCustomSitesBtn = document.getElementById("saveCustomSitesBtn");
const loadDefaultSitesBtn = document.getElementById("loadDefaultSitesBtn");
const resetCustomSitesBtn = document.getElementById("resetCustomSitesBtn");

// ---------- 全局状态 ----------
let allSitesConfig = null;
let defaultSitesConfig = null;
let activeSites = [];
let currentIndex = 0;
let isUsingCustomSites = false;

// ---------- 存储键 ----------
const STORAGE_KEYS = {
  projectName: "projectName",
  subjectName: "subjectName",
  currentIndex: "currentSiteIndex",
  customSites: "customSites"
};

// ==============================
// 初始化
// ==============================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadStoredProjectInfo();
    await loadSitesConfig();
    await loadCurrentIndex();
    renderCurrentSite();
    bindEvents();

    setStatus("已加载网站清单。");
  } catch (error) {
    console.error(error);
    setStatus(`初始化失败：${error.message}`, true);
  }
});

// ==============================
// 加载本地存储的项目信息
// ==============================

async function loadStoredProjectInfo() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.projectName,
    STORAGE_KEYS.subjectName
  ]);

  projectNameInput.value = data[STORAGE_KEYS.projectName] || "";
  subjectNameInput.value = data[STORAGE_KEYS.subjectName] || "";
}

// ==============================
// 加载 sites.json，并优先使用用户保存的自定义清单
// ==============================

async function loadSitesConfig() {
  const configUrl = chrome.runtime.getURL("sites.json");
  const response = await fetch(configUrl);

  if (!response.ok) {
    throw new Error("无法读取 sites.json");
  }

  defaultSitesConfig = await response.json();

  const data = await chrome.storage.local.get([STORAGE_KEYS.customSites]);
  const customSites = Array.isArray(data[STORAGE_KEYS.customSites])
    ? data[STORAGE_KEYS.customSites]
    : [];

  if (customSites.length > 0) {
    allSitesConfig = createConfigFromSites(customSites);
    isUsingCustomSites = true;
  } else {
    allSitesConfig = defaultSitesConfig;
    isUsingCustomSites = false;
  }

  activeSites = resolveActiveSites(allSitesConfig);

  if (!Array.isArray(activeSites) || activeSites.length === 0) {
    throw new Error("当前网站清单为空，请检查 sites.json 或自定义清单");
  }

  renderSiteListEditor();
}

// ==============================
// 将自定义网站数组包装成和 sites.json 一致的配置结构
// ==============================

function createConfigFromSites(sites) {
  return {
    version: "custom",
    activeProfile: "custom",
    profiles: [
      {
        id: "custom",
        name: "自定义诚信核查清单",
        description: "用户在插件弹窗中保存的核查网站清单。",
        siteIds: sites.map((site) => site.id)
      }
    ],
    sites
  };
}

// ==============================
// 根据 activeProfile 解析当前启用网站
// 支持网站数量少于 10 或多于 40，不写死数量
// ==============================

function resolveActiveSites(config) {
  const sites = Array.isArray(config.sites) ? config.sites : [];
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];

  const activeProfileId = config.activeProfile || "default";
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);

  // 优先按 profile.siteIds 的顺序读取
  if (activeProfile && Array.isArray(activeProfile.siteIds)) {
    return activeProfile.siteIds
      .map((siteId, index) => {
        const site = sites.find((item) => item.id === siteId);
        if (!site || site.enabled === false) return null;

        return {
          ...site,
          displayOrder: index + 1
        };
      })
      .filter(Boolean);
  }

  // 如果没有 profile，则回退到 enabled + order 排序
  return sites
    .filter((site) => site.enabled !== false)
    .sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : 9999;
      const orderB = Number.isFinite(b.order) ? b.order : 9999;
      return orderA - orderB;
    })
    .map((site, index) => ({
      ...site,
      displayOrder: index + 1
    }));
}

// ==============================
// 加载当前进度
// ==============================

async function loadCurrentIndex() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.currentIndex]);
  const savedIndex = Number(data[STORAGE_KEYS.currentIndex]);

  if (Number.isInteger(savedIndex) && savedIndex >= 0) {
    currentIndex = Math.min(savedIndex, activeSites.length - 1);
  } else {
    currentIndex = 0;
  }
}

// ==============================
// 保存当前进度
// ==============================

async function saveCurrentIndex() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.currentIndex]: currentIndex
  });
}

// ==============================
// 渲染当前网站
// ==============================

function renderCurrentSite() {
  if (!activeSites.length) {
    currentSiteNameEl.textContent = "暂无网站";
    currentSiteUrlEl.textContent = "请检查 sites.json 或自定义清单";
    progressTextEl.textContent = "进度：0 / 0";
    return;
  }

  const site = getCurrentSite();

  currentSiteNameEl.textContent = site.name || "未命名网站";
  currentSiteUrlEl.textContent = site.url || "未配置网址";
  progressTextEl.textContent = `进度：${currentIndex + 1} / ${activeSites.length}`;
}

// ==============================
// 渲染网站清单编辑区
// ==============================

function renderSiteListEditor() {
  const sourceText = isUsingCustomSites ? "自定义清单" : "默认清单";

  siteListSourceEl.textContent = `当前使用：${sourceText}，共 ${activeSites.length} 个网站。`;
  customSitesTextArea.value = formatSitesForTextarea(activeSites);
}

function formatSitesForTextarea(sites) {
  return sites
    .map((site) => `${site.name || ""} | ${site.url || ""}`)
    .join("\n");
}

// ==============================
// 获取当前网站
// ==============================

function getCurrentSite() {
  return activeSites[currentIndex];
}

// ==============================
// 绑定事件
// ==============================

function bindEvents() {
  projectNameInput.addEventListener("input", handleProjectNameChange);
  subjectNameInput.addEventListener("input", handleSubjectNameChange);

  openCurrentBtn.addEventListener("click", handleOpenCurrentSite);
  openPreviousBtn.addEventListener("click", handleOpenPreviousSite);
  openNextBtn.addEventListener("click", handleOpenNextSite);
  copySubjectBtn.addEventListener("click", handleCopySubjectName);
  newProjectBtn.addEventListener("click", handleNewProject);
  captureBtn.addEventListener("click", handleCaptureCurrentPage);
  skipBtn.addEventListener("click", handleSkipCurrentSite);
  resetBtn.addEventListener("click", handleResetProgress);
  saveCustomSitesBtn.addEventListener("click", handleSaveCustomSites);
  loadDefaultSitesBtn.addEventListener("click", handleLoadDefaultSitesIntoEditor);
  resetCustomSitesBtn.addEventListener("click", handleResetCustomSites);
}

// ==============================
// 保存项目名称
// ==============================

async function handleProjectNameChange() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.projectName]: projectNameInput.value.trim()
  });
}

// ==============================
// 保存主体名称
// ==============================

async function handleSubjectNameChange() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.subjectName]: subjectNameInput.value.trim()
  });
}

// ==============================
// 打开当前网站
// ==============================

async function handleOpenCurrentSite() {
  const site = getCurrentSite();

  if (!site || !site.url) {
    setStatus("当前网站未配置网址。", true);
    return;
  }

  await chrome.tabs.create({
    url: site.url,
    active: true
  });

  setStatus(`已打开：${site.name}`);
}

// ==============================
// 打开上一个网站
// ==============================

async function handleOpenPreviousSite() {
  if (!activeSites.length) {
    setStatus("暂无可用网站。", true);
    return;
  }

  if (currentIndex <= 0) {
    setStatus("已经是第一个网站。");
    return;
  }

  currentIndex -= 1;
  await saveCurrentIndex();
  renderCurrentSite();

  const site = getCurrentSite();

  if (site && site.url) {
    await chrome.tabs.create({
      url: site.url,
      active: true
    });

    setStatus(`已切换并打开：${site.name}`);
  } else {
    setStatus("已切换到上一个网站，但该网站未配置网址。", true);
  }
}

// ==============================
// 打开下一个网站
// ==============================

async function handleOpenNextSite() {
  if (!activeSites.length) {
    setStatus("暂无可用网站。", true);
    return;
  }

  if (currentIndex < activeSites.length - 1) {
    currentIndex += 1;
    await saveCurrentIndex();
    renderCurrentSite();

    const site = getCurrentSite();

    if (site && site.url) {
      await chrome.tabs.create({
        url: site.url,
        active: true
      });

      setStatus(`已切换并打开：${site.name}`);
    } else {
      setStatus("已切换到下一个网站，但该网站未配置网址。", true);
    }
  } else {
    setStatus("已经是最后一个网站。");
  }
}

// ==============================
// 复制主体名称
// ==============================

async function handleCopySubjectName() {
  const subjectName = subjectNameInput.value.trim();

  if (!subjectName) {
    setStatus("请先填写核查主体名称。", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(subjectName);
    setStatus(`已复制主体名称：${subjectName}`);
  } catch (error) {
    console.error(error);
    setStatus("复制失败，请手动复制主体名称。", true);
  }
}

// ==============================
// 新建项目
// 说明：保存项目信息，并将进度重置到第一个网站
// ==============================

async function handleNewProject() {
  const confirmed = confirm(
    "确定要新建项目吗？\n\n该操作会保存当前项目名称和核查主体名称，并将网站进度重置到第一个网站。已下载到本地的截图不会被删除。"
  );

  if (!confirmed) return;

  try {
    // 1. 保存当前输入的项目名称和主体名称
    await chrome.storage.local.set({
      [STORAGE_KEYS.projectName]: projectNameInput.value.trim(),
      [STORAGE_KEYS.subjectName]: subjectNameInput.value.trim()
    });

    // 2. 重置网站进度
    currentIndex = 0;
    await saveCurrentIndex();
    renderCurrentSite();

    setStatus("已新建项目：网站进度已重置。");
  } catch (error) {
    console.error(error);
    setStatus(`新建项目失败：${error.message}`, true);
  }
}

// ==============================
// 截取整个屏幕
// 说明：必须选择“整个屏幕”，这样截图中才会包含 Windows 任务栏右下角系统时间。
// ==============================

async function captureFullScreen() {
  if (!chrome.desktopCapture || !chrome.desktopCapture.chooseDesktopMedia) {
    throw new Error("当前浏览器不支持 desktopCapture，请确认 manifest.json 已添加 desktopCapture 权限并重新加载插件。");
  }

  const streamId = await new Promise((resolve, reject) => {
    chrome.desktopCapture.chooseDesktopMedia(["screen"], (id) => {
      if (!id) {
        reject(new Error("已取消屏幕选择。"));
        return;
      }

      resolve(id);
    });
  });

  let stream = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: streamId,
          maxWidth: 7680,
          maxHeight: 4320
        }
      }
    });

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("屏幕画面加载超时，请重新尝试截图。"));
      }, 10000);

      video.onloadedmetadata = async () => {
        try {
          clearTimeout(timer);
          await video.play();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("屏幕画面读取失败。"));
      };
    });

    await preparePopupForCapture();

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  } finally {
    restorePopupAfterCapture();

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}

// ==============================
// 截图前临时隐藏插件弹窗
// ==============================

async function preparePopupForCapture() {
  document.body.classList.add("capture-hidden");

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 800));
}

function restorePopupAfterCapture() {
  document.body.classList.remove("capture-hidden");
}

// ==============================
// 保存当前截图
// popup.js 负责截取整个屏幕，background.js 负责加标注和保存图片。
// ==============================

async function handleCaptureCurrentPage() {
  const projectName = projectNameInput.value.trim();
  const subjectName = subjectNameInput.value.trim();
  const site = getCurrentSite();

  if (!projectName) {
    setStatus("请先填写项目名称。", true);
    return;
  }

  if (!subjectName) {
    setStatus("请先填写核查主体名称。", true);
    return;
  }

  if (!site) {
    setStatus("当前网站不存在。", true);
    return;
  }

  setStatus("请选择“整个屏幕”进行截图，确保右下角系统时间被保存...");

  try {
    const rawImageDataUrl = await captureFullScreen();

    setStatus("全屏截图已获取，正在保存图片...");

    const response = await chrome.runtime.sendMessage({
      type: "CAPTURE_CURRENT_PAGE",
      payload: {
        projectName,
        subjectName,
        siteIndex: currentIndex + 1,
        totalSites: activeSites.length,
        site,
        rawImageDataUrl,
        screenshotType: "full_screen"
      }
    });

    if (!response || !response.success) {
      const errorMessage = response?.error || "截图保存失败";
      setStatus(errorMessage, true);
      return;
    }

    setStatus(`截图已保存：${response.filename || "已完成"}`);
  } catch (error) {
    console.error(error);
    setStatus(`全屏截图失败：${error.message}`, true);
  }
}

// ==============================
// 跳过当前网站
// ==============================

async function handleSkipCurrentSite() {
  const site = getCurrentSite();

  if (!site) {
    setStatus("当前网站不存在。", true);
    return;
  }

  if (currentIndex < activeSites.length - 1) {
    currentIndex += 1;
    await saveCurrentIndex();
    renderCurrentSite();
    setStatus(`已跳过：${site.name}`);
  } else {
    setStatus("当前已是最后一个网站，无需继续跳过。");
  }
}

// ==============================
// 重置进度
// ==============================

async function handleResetProgress() {
  const confirmed = confirm("确定要将核查进度重置到第一个网站吗？");

  if (!confirmed) return;

  currentIndex = 0;
  await saveCurrentIndex();
  renderCurrentSite();

  setStatus("进度已重置。");
}

// ==============================
// 保存自定义网站清单
// ==============================

async function handleSaveCustomSites() {
  try {
    const customSites = parseSitesFromTextarea(customSitesTextArea.value);

    await chrome.storage.local.set({
      [STORAGE_KEYS.customSites]: customSites,
      [STORAGE_KEYS.currentIndex]: 0
    });

    allSitesConfig = createConfigFromSites(customSites);
    activeSites = resolveActiveSites(allSitesConfig);
    currentIndex = 0;
    isUsingCustomSites = true;

    renderCurrentSite();
    renderSiteListEditor();
    setStatus(`已保存自定义清单：${activeSites.length} 个网站。`);
  } catch (error) {
    console.error(error);
    setStatus(`保存自定义清单失败：${error.message}`, true);
  }
}

function parseSitesFromTextarea(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请至少填写一个网站。");
  }

  return lines.map((line, index) => {
    const parts = line.split("|");

    if (parts.length < 2) {
      throw new Error(`第 ${index + 1} 行格式不正确，请使用“网站名称 | 网址”。`);
    }

    const name = parts[0].trim();
    const url = parts.slice(1).join("|").trim();

    if (!name) {
      throw new Error(`第 ${index + 1} 行缺少网站名称。`);
    }

    if (!isValidHttpUrl(url)) {
      throw new Error(`第 ${index + 1} 行网址无效，请填写 http 或 https 开头的网址。`);
    }

    return {
      id: `custom_${index + 1}`,
      order: index + 1,
      name,
      category: "自定义",
      url,
      enabled: true,
      inputSelector: "",
      searchButtonSelector: "",
      needCaptcha: false,
      remark: "用户自定义核查网站。"
    };
  });
}

function isValidHttpUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (error) {
    return false;
  }
}

// ==============================
// 将默认清单填入编辑框，便于用户按需删改
// ==============================

function handleLoadDefaultSitesIntoEditor() {
  const defaultSites = resolveActiveSites(defaultSitesConfig);

  customSitesTextArea.value = formatSitesForTextarea(defaultSites);
  setStatus("已填入默认清单，可删改后点击“保存自定义清单”。");
}

// ==============================
// 恢复使用 sites.json 默认清单
// ==============================

async function handleResetCustomSites() {
  const confirmed = confirm(
    "确定要恢复默认网站清单吗？\n\n该操作会清除已保存的自定义网站列表，并将网站进度重置到第一个网站。"
  );

  if (!confirmed) return;

  await chrome.storage.local.remove([STORAGE_KEYS.customSites]);

  allSitesConfig = defaultSitesConfig;
  activeSites = resolveActiveSites(allSitesConfig);
  currentIndex = 0;
  isUsingCustomSites = false;
  await saveCurrentIndex();

  renderCurrentSite();
  renderSiteListEditor();
  setStatus("已恢复默认网站清单。");
}

// ==============================
// 状态栏提示
// ==============================

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#4b5563";
}
