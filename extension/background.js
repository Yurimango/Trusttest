// ==============================
// 诚信核查插件工具包 - background.js
// 负责：截图、加标注、保存图片
// ==============================

// ---------- 消息监听 ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "CAPTURE_CURRENT_PAGE") {
    handleCaptureCurrentPage(message.payload)
      .then((result) => {
        sendResponse({
          success: true,
          ...result
        });
      })
      .catch((error) => {
        console.error(error);
        sendResponse({
          success: false,
          error: error.message || "截图保存失败"
        });
      });

    return true;
  }
});

// ==============================
// 核心：截图当前页面
// ==============================

async function handleCaptureCurrentPage(payload) {
  validatePayload(payload);

  const {
    projectName,
    subjectName,
    siteIndex,
    site,
    rawImageDataUrl
  } = payload;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("未找到当前活动标签页。");
  }

  const capturedAt = formatDateTimeForDisplay(new Date());
  const timeForFile = formatDateTimeForFile(new Date());

  // 1. 使用 popup.js 传入的全屏幕截图
  // 注意：不能再使用 chrome.tabs.captureVisibleTab，否则无法截到 Windows 任务栏右下角时间。
  if (!rawImageDataUrl || !String(rawImageDataUrl).startsWith("data:image/")) {
    throw new Error("缺少全屏幕截图数据，请重新点击保存截图并选择整个屏幕。");
  }

  // 2. 给截图顶部加标注栏
  const annotatedImageDataUrl = await addHeaderToScreenshot(rawImageDataUrl, {
    siteName: site.name || "未命名网站",
    subjectName,
    capturedAt,
    url: tab.url || site.url || "",
    pageTitle: tab.title || ""
  });

  // 3. 生成文件名
  const safeProjectName = sanitizeFileName(projectName);
  const safeSubjectName = sanitizeFileName(subjectName);
  const safeSiteName = sanitizeFileName(site.name || "未命名网站");

  const paddedIndex = String(siteIndex).padStart(2, "0");

  const screenshotFilename =
    `诚信核查插件工具包/` +
    `${safeProjectName}/` +
    `${safeSubjectName}/` +
    `screenshots/` +
    `${paddedIndex}_${safeSiteName}_${safeSubjectName}_${timeForFile}.png`;

  // 4. 下载截图
  await chrome.downloads.download({
    url: annotatedImageDataUrl,
    filename: screenshotFilename,
    saveAs: false,
    conflictAction: "uniquify"
  });

  return {
    filename: screenshotFilename
  };
}

// ==============================
// 校验参数
// ==============================

function validatePayload(payload) {
  if (!payload) {
    throw new Error("缺少截图参数。");
  }

  if (!payload.projectName) {
    throw new Error("缺少项目名称。");
  }

  if (!payload.subjectName) {
    throw new Error("缺少核查主体名称。");
  }

  if (!payload.site) {
    throw new Error("缺少当前网站信息。");
  }

  if (!payload.site.name) {
    throw new Error("当前网站缺少名称。");
  }
}

// ==============================
// 给截图顶部加标注栏
// ==============================

async function addHeaderToScreenshot(imageDataUrl, meta) {
  const imageBlob = await dataUrlToBlob(imageDataUrl);
  const imageBitmap = await createImageBitmap(imageBlob);

  const headerHeight = 150;
  const paddingX = 24;
  const paddingY = 18;

  const width = imageBitmap.width;
  const height = imageBitmap.height + headerHeight;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 背景
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 顶部标注栏背景
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, width, headerHeight);

  // 标注栏底部分割线
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(0, headerHeight - 1, width, 1);

  // 主标题
  ctx.fillStyle = "#111827";
  ctx.font = "bold 22px Microsoft YaHei, Arial, sans-serif";
  ctx.fillText(`核查网站：${meta.siteName}`, paddingX, paddingY + 22);

  // 其他信息
  ctx.fillStyle = "#374151";
  ctx.font = "16px Microsoft YaHei, Arial, sans-serif";

  ctx.fillText(`核查主体：${meta.subjectName}`, paddingX, paddingY + 52);
  ctx.fillText(`核查时间：${meta.capturedAt}`, paddingX, paddingY + 82);

  const urlText = `页面链接：${meta.url || ""}`;
  drawSingleLineText(ctx, urlText, paddingX, paddingY + 112, width - paddingX * 2);

  // 原始全屏幕截图
  ctx.drawImage(imageBitmap, 0, headerHeight);

  const outputBlob = await canvas.convertToBlob({
    type: "image/png"
  });

  return blobToDataUrl(outputBlob);
}

// ==============================
// 防止 URL 太长超出画布
// ==============================

function drawSingleLineText(ctx, text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let truncated = text;

  while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  ctx.fillText(truncated + "...", x, y);
}

// ==============================
// 文件名清理
// ==============================

function sanitizeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

// ==============================
// 时间格式：用于展示
// ==============================

function formatDateTimeForDisplay(date) {
  const pad = (n) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// ==============================
// 时间格式：用于文件名
// ==============================

function formatDateTimeForFile(date) {
  const pad = (n) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

// ==============================
// dataURL 转 Blob
// ==============================

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

// ==============================
// Blob 转 dataURL
// ==============================

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片转换失败。"));

    reader.readAsDataURL(blob);
  });
}
