const Core = window.PinBeanCore;

const STORAGE_KEYS = {
  inventory: "pin_bead_helper_inventory",
  settings: "pin_bead_helper_settings",
  project: "pin_bead_helper_project",
  guideProgress: "pin_bead_helper_guide_progress",
  importedPatterns: "pin_bead_helper_imported_patterns"
};

const $ = (id) => document.getElementById(id);

const els = {
  imageInput: $("imageInput"),
  dropZone: $("dropZone"),
  sourcePreview: $("sourcePreview"),
  cropPanel: $("cropPanel"),
  cropCanvas: $("cropCanvas"),
  resetCropButton: $("resetCropButton"),
  autoCropChartButton: $("autoCropChartButton"),
  centerCropButton: $("centerCropButton"),
  brandSelect: $("brandSelect"),
  presetSelect: $("presetSelect"),
  gridWidth: $("gridWidth"),
  gridHeight: $("gridHeight"),
  removeBackground: $("removeBackground"),
  backgroundMode: $("backgroundMode"),
  ignoreWatermark: $("ignoreWatermark"),
  generateButton: $("generateButton"),
  recognizeChartButton: $("recognizeChartButton"),
  suggestGridButton: $("suggestGridButton"),
  statusText: $("statusText"),
  paletteSearch: $("paletteSearch"),
  paletteGrid: $("paletteGrid"),
  selectCommonButton: $("selectCommonButton"),
  clearInventoryButton: $("clearInventoryButton"),
  projectTitle: $("projectTitle"),
  canvasTitle: $("canvasTitle"),
  canvasMeta: $("canvasMeta"),
  patternCanvas: $("patternCanvas"),
  previewCanvas: $("previewCanvas"),
  workCanvas: $("workCanvas"),
  summaryGrid: $("summaryGrid"),
  missingBox: $("missingBox"),
  clearHighlightButton: $("clearHighlightButton"),
  downloadButton: $("downloadButton"),
  shareButton: $("shareButton"),
  fitButton: $("fitButton"),
  previewModes: $("previewModes"),
  guideCanvas: $("guideCanvas"),
  guideTitle: $("guideTitle"),
  guideMeta: $("guideMeta"),
  guideProgressText: $("guideProgressText"),
  guideProgressFill: $("guideProgressFill"),
  guideCurrent: $("guideCurrent"),
  guideSteps: $("guideSteps"),
  markSectionDoneButton: $("markSectionDoneButton"),
  undoSectionButton: $("undoSectionButton"),
  resetGuideButton: $("resetGuideButton"),
  patternSearch: $("patternSearch"),
  libraryCategory: $("libraryCategory"),
  libraryGrid: $("libraryGrid"),
  importPackButton: $("importPackButton"),
  patternPackInput: $("patternPackInput"),
  saveCurrentPatternButton: $("saveCurrentPatternButton")
};

const state = {
  image: null,
  imageName: "",
  imageSize: null,
  objectUrl: "",
  cropRect: { x: 0, y: 0, width: 1, height: 1 },
  cropLayout: null,
  cropDrag: null,
  currentProject: null,
  selectedColorId: "",
  previewMode: "beads",
  activeGuideSectionId: "",
  guideSections: [],
  guideLayout: null,
  guideProgress: loadJson(STORAGE_KEYS.guideProgress, {}),
  importedPatterns: loadJson(STORAGE_KEYS.importedPatterns, []),
  inventory: loadJson(STORAGE_KEYS.inventory, { mard: [], artkal: [] }),
  settings: loadJson(STORAGE_KEYS.settings, {
    brand: "mard",
    presetId: "mard-120",
    gridWidth: 36,
    gridHeight: 36,
    removeBackground: true,
    backgroundMode: "auto",
    ignoreWatermark: true
  })
};

boot();

function boot() {
  restoreSettings();
  bindEvents();
  renderPresetOptions();
  renderPaletteGrid();
  renderLibraryCategories();
  renderLibrary();

  const savedProject = loadJson(STORAGE_KEYS.project, null);
  if (savedProject && savedProject.cells) {
    setProject(savedProject, false);
  } else {
    renderEmptyCanvas();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function restoreSettings() {
  els.brandSelect.value = state.settings.brand;
  els.gridWidth.value = state.settings.gridWidth;
  els.gridHeight.value = state.settings.gridHeight;
  els.removeBackground.checked = state.settings.removeBackground !== false;
  els.backgroundMode.value = state.settings.backgroundMode || "auto";
  els.ignoreWatermark.checked = state.settings.ignoreWatermark !== false;
}

function bindEvents() {
  els.imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) loadImageFile(file);
  });

  ["dragenter", "dragover"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImageFile(file);
  });

  els.brandSelect.addEventListener("change", () => {
    state.settings.brand = els.brandSelect.value;
    state.settings.presetId = `${state.settings.brand}-120`;
    saveSettings();
    renderPresetOptions();
    renderPaletteGrid();
  });

  els.presetSelect.addEventListener("change", () => {
    state.settings.presetId = els.presetSelect.value;
    saveSettings();
    renderPaletteGrid();
  });

  [els.gridWidth, els.gridHeight].forEach((input) => {
    input.addEventListener("change", () => {
      input.value = String(clamp(Number(input.value) || 36, 1, 160));
      state.settings.gridWidth = Number(els.gridWidth.value);
      state.settings.gridHeight = Number(els.gridHeight.value);
      saveSettings();
    });
  });

  els.removeBackground.addEventListener("change", () => {
    state.settings.removeBackground = els.removeBackground.checked;
    saveSettings();
  });

  els.backgroundMode.addEventListener("change", () => {
    state.settings.backgroundMode = els.backgroundMode.value;
    saveSettings();
  });

  els.ignoreWatermark.addEventListener("change", () => {
    state.settings.ignoreWatermark = els.ignoreWatermark.checked;
    saveSettings();
  });

  els.suggestGridButton.addEventListener("click", suggestGridSize);
  els.generateButton.addEventListener("click", generateProject);
  els.recognizeChartButton.addEventListener("click", recognizeChartProject);
  els.resetCropButton.addEventListener("click", resetCrop);
  els.autoCropChartButton.addEventListener("click", autoCropChart);
  els.centerCropButton.addEventListener("click", centerCropSubject);
  els.cropCanvas.addEventListener("pointerdown", startCropDrag);
  els.cropCanvas.addEventListener("pointermove", moveCropDrag);
  els.cropCanvas.addEventListener("pointerup", endCropDrag);
  els.cropCanvas.addEventListener("pointercancel", endCropDrag);
  els.paletteSearch.addEventListener("input", renderPaletteGrid);
  els.selectCommonButton.addEventListener("click", selectCommonInventory);
  els.clearInventoryButton.addEventListener("click", clearInventory);
  els.clearHighlightButton.addEventListener("click", () => {
    state.selectedColorId = "";
    renderProject();
  });
  els.fitButton.addEventListener("click", renderProject);
  els.downloadButton.addEventListener("click", downloadProject);
  els.shareButton.addEventListener("click", shareApp);
  els.guideCanvas.addEventListener("click", handleGuideCanvasClick);
  els.markSectionDoneButton.addEventListener("click", markActiveSectionDone);
  els.undoSectionButton.addEventListener("click", undoActiveSection);
  els.resetGuideButton.addEventListener("click", resetGuideProgress);
  els.patternSearch.addEventListener("input", renderLibrary);
  els.libraryCategory.addEventListener("change", renderLibrary);
  els.importPackButton.addEventListener("click", () => els.patternPackInput.click());
  els.patternPackInput.addEventListener("change", importPatternPack);
  els.saveCurrentPatternButton.addEventListener("click", saveCurrentProjectToLibrary);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.previewModes.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.previewMode = button.dataset.mode;
    els.previewModes.querySelectorAll(".mode-card").forEach((item) => item.classList.toggle("active", item === button));
    renderPreview();
  });

  window.addEventListener("resize", debounce(() => {
    renderProject();
    renderCropCanvas();
  }, 120));
}

function renderPresetOptions() {
  const brand = els.brandSelect.value;
  const presets = Core.PRESETS[brand];
  els.presetSelect.innerHTML = presets.map((preset) => (
    `<option value="${preset.id}">${preset.name}</option>`
  )).join("");
  els.presetSelect.value = state.settings.presetId.startsWith(brand)
    ? state.settings.presetId
    : `${brand}-120`;
}

async function loadImageFile(file) {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  state.imageName = file.name.replace(/\.[^.]+$/, "") || "拼豆图纸";
  setStatus("正在读取图片...");

  const image = await loadImage(state.objectUrl);
  state.image = image;
  state.imageSize = { width: image.naturalWidth, height: image.naturalHeight };
  state.cropRect = { x: 0, y: 0, width: 1, height: 1 };
  els.sourcePreview.src = state.objectUrl;
  els.sourcePreview.hidden = false;
  els.cropPanel.hidden = false;
  renderCropCanvas();
  syncGridToCrop({ preferChart: false, silent: true });
  setStatus(`已读取 ${image.naturalWidth}x${image.naturalHeight}，可以生成图纸。`);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//.test(src)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function renderCropCanvas() {
  if (!state.image) return;
  const canvas = els.cropCanvas;
  const parentWidth = Math.max(260, canvas.parentElement.clientWidth - 2);
  const ratio = Math.min(1, parentWidth / state.image.naturalWidth);
  const drawWidth = Math.round(state.image.naturalWidth * ratio);
  const drawHeight = Math.round(state.image.naturalHeight * ratio);
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(drawWidth * pixelRatio);
  canvas.height = Math.round(drawHeight * pixelRatio);
  canvas.style.width = `${drawWidth}px`;
  canvas.style.height = `${drawHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, drawWidth, drawHeight);
  ctx.drawImage(state.image, 0, 0, drawWidth, drawHeight);

  const rect = normalizeCropRect(state.cropRect);
  const x = rect.x * drawWidth;
  const y = rect.y * drawHeight;
  const width = rect.width * drawWidth;
  const height = rect.height * drawHeight;
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(0, 0, drawWidth, y);
  ctx.fillRect(0, y + height, drawWidth, drawHeight - y - height);
  ctx.fillRect(0, y, x, height);
  ctx.fillRect(x + width, y, drawWidth - x - width, height);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.strokeStyle = "#1b1b18";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  drawCropHandle(ctx, x, y);
  drawCropHandle(ctx, x + width, y);
  drawCropHandle(ctx, x, y + height);
  drawCropHandle(ctx, x + width, y + height);
  state.cropLayout = { width: drawWidth, height: drawHeight };
}

function drawCropHandle(ctx, x, y) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#1b1b18";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function startCropDrag(event) {
  if (!state.image || !state.cropLayout) return;
  const point = cropPointFromEvent(event);
  const rect = normalizeCropRect(state.cropRect);
  const mode = cropHitMode(point, rect);
  state.cropDrag = { mode, start: point, rect };
  els.cropCanvas.setPointerCapture(event.pointerId);
}

function moveCropDrag(event) {
  if (!state.cropDrag) return;
  const point = cropPointFromEvent(event);
  const dx = point.x - state.cropDrag.start.x;
  const dy = point.y - state.cropDrag.start.y;
  const rect = { ...state.cropDrag.rect };
  const minSize = 0.08;

  if (state.cropDrag.mode === "move") {
    rect.x += dx;
    rect.y += dy;
  } else {
    if (state.cropDrag.mode.includes("w")) {
      rect.x += dx;
      rect.width -= dx;
    }
    if (state.cropDrag.mode.includes("e")) {
      rect.width += dx;
    }
    if (state.cropDrag.mode.includes("n")) {
      rect.y += dy;
      rect.height -= dy;
    }
    if (state.cropDrag.mode.includes("s")) {
      rect.height += dy;
    }
  }

  rect.width = Math.max(minSize, rect.width);
  rect.height = Math.max(minSize, rect.height);
  state.cropRect = normalizeCropRect(rect);
  renderCropCanvas();
}

function endCropDrag(event) {
  if (!state.cropDrag) return;
  try {
    els.cropCanvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture may already be released on some mobile browsers.
  }
  state.cropDrag = null;
  syncGridToCrop({ preferChart: true, silent: false });
}

function cropPointFromEvent(event) {
  const bounds = els.cropCanvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
    y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
  };
}

function cropHitMode(point, rect) {
  const threshold = 0.045;
  const nearW = Math.abs(point.x - rect.x) < threshold;
  const nearE = Math.abs(point.x - (rect.x + rect.width)) < threshold;
  const nearN = Math.abs(point.y - rect.y) < threshold;
  const nearS = Math.abs(point.y - (rect.y + rect.height)) < threshold;
  if (nearW && nearN) return "nw";
  if (nearE && nearN) return "ne";
  if (nearW && nearS) return "sw";
  if (nearE && nearS) return "se";
  if (nearW) return "w";
  if (nearE) return "e";
  if (nearN) return "n";
  if (nearS) return "s";
  return "move";
}

function normalizeCropRect(rect) {
  const next = {
    x: clamp(rect.x, 0, 1),
    y: clamp(rect.y, 0, 1),
    width: clamp(rect.width, 0.02, 1),
    height: clamp(rect.height, 0.02, 1)
  };
  if (next.x + next.width > 1) next.x = 1 - next.width;
  if (next.y + next.height > 1) next.y = 1 - next.height;
  return next;
}

function resetCrop() {
  state.cropRect = { x: 0, y: 0, width: 1, height: 1 };
  renderCropCanvas();
  syncGridToCrop({ preferChart: false, silent: true });
  setStatus("裁剪区域已恢复为全图，格数已按比例更新。");
}

function centerCropSubject() {
  if (!state.image) return;
  state.cropRect = { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
  renderCropCanvas();
  syncGridToCrop({ preferChart: false, silent: true });
  setStatus("已居中裁剪并按比例更新格数，可以继续拖动微调。");
}

function autoCropChart() {
  if (!state.image) {
    setStatus("先上传一张现成图纸。");
    return;
  }
  const imageData = getFullImageData(1200);
  const estimate = Core.estimateChartGrid(imageData);
  if (!estimate.gridWidth || !estimate.gridHeight || estimate.confidence < 0.35) {
    setStatus("没有稳定识别到网格，可以手动拖动裁剪框。");
    return;
  }
  state.cropRect = {
    x: estimate.crop.x / imageData.width,
    y: estimate.crop.y / imageData.height,
    width: estimate.crop.width / imageData.width,
    height: estimate.crop.height / imageData.height
  };
  els.gridWidth.value = estimate.gridWidth;
  els.gridHeight.value = estimate.gridHeight;
  state.settings.gridWidth = estimate.gridWidth;
  state.settings.gridHeight = estimate.gridHeight;
  saveSettings();
  renderCropCanvas();
  setStatus(`已框出约 ${estimate.gridWidth}x${estimate.gridHeight} 的网格，可直接识别。`);
}

function syncGridToCrop(options = {}) {
  if (!state.image) return;
  const preferChart = options.preferChart !== false;

  if (preferChart) {
    const chartImageData = getImageDataForPattern(1200);
    const estimate = Core.estimateChartGrid(chartImageData);
    if (estimate.gridWidth >= 4 && estimate.gridHeight >= 4 && estimate.confidence >= 0.35) {
      updateGridInputs(estimate.gridWidth, estimate.gridHeight);
      if (!options.silent) setStatus(`已按裁剪网格更新为 ${estimate.gridWidth}x${estimate.gridHeight}。`);
      return;
    }
  }

  const crop = getCropSourceRect();
  const currentLongSide = Math.max(Number(els.gridWidth.value) || 48, Number(els.gridHeight.value) || 48, 24);
  const size = Core.estimateGridSize(crop.width, crop.height, Math.min(120, currentLongSide));
  updateGridInputs(size.gridWidth, size.gridHeight);
  if (!options.silent) setStatus(`已按裁剪比例更新为 ${size.gridWidth}x${size.gridHeight}。`);
}

function updateGridInputs(gridWidth, gridHeight) {
  els.gridWidth.value = String(clamp(Math.round(gridWidth), 1, 160));
  els.gridHeight.value = String(clamp(Math.round(gridHeight), 1, 160));
  state.settings.gridWidth = Number(els.gridWidth.value);
  state.settings.gridHeight = Number(els.gridHeight.value);
  saveSettings();
}

function getFullImageData(maxSide = 1200) {
  const scale = Math.min(1, maxSide / Math.max(state.image.naturalWidth, state.image.naturalHeight));
  const width = Math.max(1, Math.round(state.image.naturalWidth * scale));
  const height = Math.max(1, Math.round(state.image.naturalHeight * scale));
  const canvas = els.workCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(state.image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function getCropSourceRect() {
  const rect = normalizeCropRect(state.cropRect);
  return {
    x: Math.round(rect.x * state.image.naturalWidth),
    y: Math.round(rect.y * state.image.naturalHeight),
    width: Math.max(1, Math.round(rect.width * state.image.naturalWidth)),
    height: Math.max(1, Math.round(rect.height * state.image.naturalHeight))
  };
}

function suggestGridSize() {
  if (!state.imageSize) {
    els.gridWidth.value = 36;
    els.gridHeight.value = 36;
    return;
  }
  syncGridToCrop({ preferChart: true, silent: false });
}

function getImageDataForPattern(maxSide = 560) {
  const crop = getCropSourceRect();
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const canvas = els.workCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(state.image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function generateProject() {
  if (!state.image) {
    setStatus("先上传一张图片，再生成拼豆图纸。");
    return;
  }

  const brand = els.brandSelect.value;
  const presetId = els.presetSelect.value;
  const customIds = state.inventory[brand] || [];
  const palette = Core.getColorsForPreset(brand, presetId, customIds);

  if (palette.filter((color) => !color.isTransparent).length < 2) {
    setStatus("我的色库至少需要选择 2 个颜色。");
    return;
  }

  setStatus("正在本地取色和匹配色号...");
  els.generateButton.disabled = true;

  requestAnimationFrame(() => {
    try {
      const imageData = getImageDataForPattern();
      const project = Core.buildPatternFromImageData({
        imageData,
        title: state.imageName || "拼豆图纸",
        brand,
        palettePresetId: presetId,
        palette,
        gridWidth: Number(els.gridWidth.value),
        gridHeight: Number(els.gridHeight.value),
        removeBackground: els.removeBackground.checked,
        backgroundMode: els.backgroundMode.value,
        sourceName: state.imageName
      });
      setProject(project, true);
      switchView("editor");
      setStatus(`完成：${project.gridWidth}x${project.gridHeight}，共 ${project.totalBeads} 颗。`);
    } catch (error) {
      setStatus(`生成失败：${error.message || "请换一张图片再试"}`);
    } finally {
      els.generateButton.disabled = false;
    }
  });
}

function recognizeChartProject() {
  if (!state.image) {
    setStatus("先上传一张现成拼豆图纸。");
    return;
  }

  const brand = els.brandSelect.value;
  const presetId = els.presetSelect.value;
  const customIds = state.inventory[brand] || [];
  const palette = Core.getColorsForPreset(brand, presetId, customIds);

  if (palette.filter((color) => !color.isTransparent).length < 2) {
    setStatus("我的色库至少需要选择 2 个颜色。");
    return;
  }

  setStatus("正在识别图纸网格和色块...");
  els.recognizeChartButton.disabled = true;

  requestAnimationFrame(() => {
    try {
      const imageData = getImageDataForPattern(1200);
      const project = Core.recognizePatternChart({
        imageData,
        title: `${state.imageName || "导入图纸"} 识别版`,
        brand,
        palettePresetId: presetId,
        palette,
        gridWidth: Number(els.gridWidth.value),
        gridHeight: Number(els.gridHeight.value),
        sourceName: state.imageName,
        ignoreWatermark: els.ignoreWatermark.checked
      });
      setProject(project, true);
      switchView("editor");
      setStatus(`识别完成：${project.gridWidth}x${project.gridHeight}，共 ${project.totalBeads} 颗。`);
    } catch (error) {
      setStatus(`识别失败：${error.message || "请先裁到网格区域再试"}`);
    } finally {
      els.recognizeChartButton.disabled = false;
    }
  });
}

function setProject(project, shouldSave) {
  state.currentProject = project;
  state.selectedColorId = "";
  ensureGuideState(project);
  if (shouldSave) {
    localStorage.setItem(STORAGE_KEYS.project, JSON.stringify(project));
  }
  renderProject();
}

function renderProject() {
  if (!state.currentProject) {
    renderEmptyCanvas();
    return;
  }

  const project = state.currentProject;
  els.projectTitle.textContent = project.title || "拼豆图纸";
  els.canvasTitle.textContent = project.title || "拼豆图纸";
  els.canvasMeta.textContent = `${project.gridWidth} x ${project.gridHeight} · ${project.totalBeads} 颗 · ${project.palettePresetId}`;

  const width = Math.max(420, Math.min(1080, els.patternCanvas.parentElement.clientWidth - 36));
  Core.drawPatternCanvas(els.patternCanvas, project, {
    width,
    selectedColorId: state.selectedColorId,
    pixelRatio: window.devicePixelRatio || 1
  });
  renderSummary();
  renderGuideIfVisible();
  renderPreview();
}

function renderEmptyCanvas() {
  els.projectTitle.textContent = "专业图纸工作台";
  els.canvasTitle.textContent = "等待生成";
  els.canvasMeta.textContent = "坐标轴、色号、统计会显示在这里";
  const canvas = els.patternCanvas;
  const ctx = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(360, Math.min(900, canvas.parentElement.clientWidth - 36));
  const height = Math.max(360, Math.min(560, Math.round(width * 0.62)));
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f4f4ef";
  ctx.fillRect(42, 42, width - 84, height - 84);
  ctx.fillStyle = "#77766f";
  ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("上传图片后，这里会生成", width / 2, height / 2 - 14);
  ctx.fillText("带坐标轴和色号的拼豆图纸", width / 2, height / 2 + 18);
  els.summaryGrid.innerHTML = '<div class="summary-empty">生成图纸后，点选任意色号就能高亮对应格子。</div>';
  els.missingBox.hidden = true;
  renderGuideEmpty();
}

function renderSummary() {
  const project = state.currentProject;
  els.summaryGrid.innerHTML = project.colorStats.map((stat) => `
    <button class="summary-chip ${state.selectedColorId === stat.colorId ? "active" : ""}" data-color-id="${stat.colorId}" type="button">
      <span class="swatch" style="background:${stat.hex}"></span>
      <span class="summary-name">
        <strong>${stat.colorId}</strong>
        <span>${stat.shortId || stat.colorId}</span>
      </span>
      <span class="summary-count">x${stat.count}</span>
    </button>
  `).join("");

  els.summaryGrid.querySelectorAll("[data-color-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedColorId = state.selectedColorId === button.dataset.colorId ? "" : button.dataset.colorId;
      renderProject();
    });
  });

  const owned = new Set(state.inventory[project.brand] || []);
  const missing = owned.size
    ? project.colorStats.filter((stat) => !owned.has(stat.colorId))
    : [];

  if (missing.length) {
    els.missingBox.hidden = false;
    els.missingBox.textContent = `缺少 ${missing.length} 个色号：${missing.map((item) => `${item.colorId} x${item.count}`).join("、")}`;
  } else {
    els.missingBox.hidden = true;
  }
}

function renderPreview() {
  if (!state.currentProject) {
    const canvas = els.previewCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = 900;
    canvas.height = 560;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const width = Math.max(420, Math.min(980, els.previewCanvas.parentElement.clientWidth - 36));
  Core.drawPreviewCanvas(els.previewCanvas, state.currentProject, {
    width,
    mode: state.previewMode,
    pixelRatio: window.devicePixelRatio || 1
  });
}

function ensureGuideState(project) {
  state.guideSections = Core.buildGuideSections(project);
  const completed = getCompletedGuideSet(project);
  const activeExists = state.guideSections.some((section) => section.id === state.activeGuideSectionId);
  if (!activeExists || completed.has(state.activeGuideSectionId)) {
    const next = state.guideSections.find((section) => !completed.has(section.id)) || state.guideSections[0];
    state.activeGuideSectionId = next ? next.id : "";
  }
}

function getCompletedGuideSet(project = state.currentProject) {
  if (!project) return new Set();
  const progress = state.guideProgress[project.id] || { completed: [] };
  return new Set(progress.completed || []);
}

function saveGuideProgress() {
  localStorage.setItem(STORAGE_KEYS.guideProgress, JSON.stringify(state.guideProgress));
}

function getActiveGuideSection() {
  return state.guideSections.find((section) => section.id === state.activeGuideSectionId) || state.guideSections[0];
}

function renderGuideIfVisible() {
  if (document.getElementById("guideView").classList.contains("active")) {
    renderGuide();
  }
}

function renderGuideEmpty() {
  els.guideTitle.textContent = "拼豆模式";
  els.guideMeta.textContent = "生成图纸后自动分区";
  els.guideProgressText.textContent = "0 / 0";
  els.guideProgressFill.style.width = "0%";
  els.guideCurrent.innerHTML = '<div class="summary-empty">生成图纸后，这里会显示下一块区域、坐标和本区色号。</div>';
  els.guideSteps.innerHTML = "";
  els.markSectionDoneButton.disabled = true;
  els.undoSectionButton.disabled = true;
  els.resetGuideButton.disabled = true;

  const canvas = els.guideCanvas;
  const ctx = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(360, Math.min(900, canvas.parentElement.clientWidth - 36));
  const height = Math.max(360, Math.min(560, Math.round(width * 0.62)));
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f4f4ef";
  ctx.fillRect(42, 42, width - 84, height - 84);
  ctx.fillStyle = "#77766f";
  ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("拼豆模式会把图纸切成小块", width / 2, height / 2 - 14);
  ctx.fillText("完成一块，再进入下一块", width / 2, height / 2 + 18);
}

function renderGuide() {
  const project = state.currentProject;
  if (!project) {
    renderGuideEmpty();
    return;
  }

  ensureGuideState(project);
  const completed = getCompletedGuideSet(project);
  const activeSection = getActiveGuideSection();
  const completedCount = state.guideSections.filter((section) => completed.has(section.id)).length;
  const completedBeads = state.guideSections
    .filter((section) => completed.has(section.id))
    .reduce((sum, section) => sum + section.totalBeads, 0);
  const progress = state.guideSections.length ? Math.round((completedCount / state.guideSections.length) * 100) : 0;

  els.guideTitle.textContent = activeSection ? `${activeSection.label} · ${activeSection.boundsLabel}` : "拼豆完成";
  els.guideMeta.textContent = `${completedBeads} / ${project.totalBeads} 颗 · ${progress}%`;
  els.guideProgressText.textContent = `${completedCount} / ${state.guideSections.length}`;
  els.guideProgressFill.style.width = `${progress}%`;
  els.resetGuideButton.disabled = state.guideSections.length === 0 || completedCount === 0;

  const width = Math.max(420, Math.min(1080, els.guideCanvas.parentElement.clientWidth - 36));
  state.guideLayout = Core.drawPatternCanvas(els.guideCanvas, project, {
    width,
    focusedSection: activeSection,
    guideSections: state.guideSections,
    completedSectionIds: Array.from(completed),
    pixelRatio: window.devicePixelRatio || 1
  });

  renderGuideCurrent(activeSection, completed);
  renderGuideSteps(completed);
}

function renderGuideCurrent(section, completed) {
  if (!section) {
    els.guideCurrent.innerHTML = '<div class="summary-empty">全部区域已完成。</div>';
    els.markSectionDoneButton.disabled = true;
    els.undoSectionButton.disabled = true;
    return;
  }

  const isDone = completed.has(section.id);
  const plan = section.colorPlan.slice(0, 5).map((stat) => `
    <span class="guide-color-chip">
      <span class="swatch" style="background:${stat.hex}"></span>
      <strong>${stat.colorId}</strong>
      <small>x${stat.count}</small>
    </span>
  `).join("");

  els.guideCurrent.innerHTML = `
    <div class="guide-current-card">
      <span class="guide-step-state">${isDone ? "已完成" : "下一块"}</span>
      <h3>${section.label}</h3>
      <p>${section.boundsLabel} · ${section.totalBeads} 颗</p>
      <div class="guide-color-plan">${plan}</div>
    </div>
  `;
  els.markSectionDoneButton.disabled = isDone;
  els.undoSectionButton.disabled = !isDone;
}

function renderGuideSteps(completed) {
  els.guideSteps.innerHTML = state.guideSections.map((section) => {
    const isActive = section.id === state.activeGuideSectionId;
    const isDone = completed.has(section.id);
    const first = section.colorPlan[0];
    return `
      <button class="guide-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}" data-section-id="${section.id}" type="button">
        <span class="guide-dot" style="background:${first ? first.hex : "#ddd"}"></span>
        <span>
          <strong>${section.label}</strong>
          <small>${section.boundsLabel}</small>
        </span>
        <em>${section.totalBeads}</em>
      </button>
    `;
  }).join("");

  els.guideSteps.querySelectorAll("[data-section-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeGuideSectionId = button.dataset.sectionId;
      state.selectedColorId = "";
      renderGuide();
    });
  });
}

function handleGuideCanvasClick(event) {
  if (!state.currentProject || !state.guideLayout) return;
  const rect = els.guideCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const cellX = Math.floor((x - state.guideLayout.gridX) / state.guideLayout.cellSize);
  const cellY = Math.floor((y - state.guideLayout.gridY) / state.guideLayout.cellSize);
  if (cellX < 0 || cellY < 0 || cellX >= state.currentProject.gridWidth || cellY >= state.currentProject.gridHeight) {
    return;
  }
  const section = state.guideSections.find((item) => (
    cellX >= item.x &&
    cellY >= item.y &&
    cellX < item.x + item.width &&
    cellY < item.y + item.height
  ));
  if (!section) return;
  state.activeGuideSectionId = section.id;
  renderGuide();
}

function markActiveSectionDone() {
  const project = state.currentProject;
  const section = getActiveGuideSection();
  if (!project || !section) return;
  const completed = getCompletedGuideSet(project);
  completed.add(section.id);
  state.guideProgress[project.id] = { completed: Array.from(completed), updatedAt: Date.now() };
  saveGuideProgress();

  const currentIndex = state.guideSections.findIndex((item) => item.id === section.id);
  const next = state.guideSections.slice(currentIndex + 1).find((item) => !completed.has(item.id))
    || state.guideSections.find((item) => !completed.has(item.id));
  state.activeGuideSectionId = next ? next.id : section.id;
  renderGuide();
  setStatus(next ? `已完成 ${section.label}，下一块是 ${next.label}。` : "所有分区都标记完成了。");
}

function undoActiveSection() {
  const project = state.currentProject;
  const section = getActiveGuideSection();
  if (!project || !section) return;
  const completed = getCompletedGuideSet(project);
  completed.delete(section.id);
  state.guideProgress[project.id] = { completed: Array.from(completed), updatedAt: Date.now() };
  saveGuideProgress();
  renderGuide();
  setStatus(`已撤销 ${section.label} 的完成状态。`);
}

function resetGuideProgress() {
  const project = state.currentProject;
  if (!project) return;
  delete state.guideProgress[project.id];
  saveGuideProgress();
  state.activeGuideSectionId = "";
  ensureGuideState(project);
  renderGuide();
  setStatus("拼豆模式进度已重置。");
}

function renderPaletteGrid() {
  const brand = els.brandSelect.value;
  const query = els.paletteSearch.value.trim().toUpperCase();
  const selected = new Set(state.inventory[brand] || []);
  const colors = Core.getPalette(brand).filter((color) => (
    !query || color.id.toUpperCase().includes(query) || color.shortId.toUpperCase().includes(query)
  ));

  els.paletteGrid.innerHTML = colors.map((color) => `
    <button class="palette-chip ${selected.has(color.id) ? "active" : ""}" data-color-id="${color.id}" type="button" title="${color.id}">
      <span class="swatch" style="background:${color.hex}"></span>
      <span class="chip-code">${color.id}</span>
    </button>
  `).join("");

  els.paletteGrid.querySelectorAll("[data-color-id]").forEach((button) => {
    button.addEventListener("click", () => toggleInventoryColor(brand, button.dataset.colorId));
  });
}

function toggleInventoryColor(brand, colorId) {
  const selected = new Set(state.inventory[brand] || []);
  if (selected.has(colorId)) {
    selected.delete(colorId);
  } else {
    selected.add(colorId);
  }
  state.inventory[brand] = Array.from(selected);
  saveInventory();
  renderPaletteGrid();
  renderSummaryIfNeeded();
}

function selectCommonInventory() {
  const brand = els.brandSelect.value;
  state.inventory[brand] = Core.getPreset(brand, `${brand}-120`).colorIds.slice();
  saveInventory();
  renderPaletteGrid();
  renderSummaryIfNeeded();
  setStatus("已把 120 色常用套装加入我的色库。");
}

function clearInventory() {
  const brand = els.brandSelect.value;
  state.inventory[brand] = [];
  saveInventory();
  renderPaletteGrid();
  renderSummaryIfNeeded();
}

function renderSummaryIfNeeded() {
  if (state.currentProject) renderSummary();
}

function getLibraryPatterns() {
  const imported = (state.importedPatterns || [])
    .map((item) => Core.normalizeLibraryPattern(item))
    .filter(Boolean);
  return Core.LOCAL_LIBRARY_PATTERNS.concat(imported);
}

function renderLibraryCategories() {
  const categories = Array.from(new Set(getLibraryPatterns().map((item) => item.category || "其他"))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.libraryCategory.innerHTML = ['<option value="">全部分类</option>']
    .concat(categories.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`))
    .join("");
}

function renderLibrary() {
  const query = (els.patternSearch.value || "").trim().toLowerCase();
  const category = els.libraryCategory.value;
  const patterns = getLibraryPatterns().filter((pattern) => {
    const haystack = [
      pattern.title,
      pattern.category,
      pattern.difficulty,
      pattern.sourceName,
      `${pattern.gridWidth}x${pattern.gridHeight}`
    ].concat(pattern.tags || []).join(" ").toLowerCase();
    return (!category || pattern.category === category) && (!query || haystack.includes(query));
  });

  if (!patterns.length) {
    els.libraryGrid.innerHTML = '<div class="summary-empty">没有找到匹配的图纸。</div>';
    return;
  }

  els.libraryGrid.innerHTML = patterns.map((pattern) => libraryCardHtml(pattern)).join("");
  els.libraryGrid.querySelectorAll("[data-pattern-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const pattern = getLibraryPatterns().find((item) => item.id === button.dataset.patternId);
      if (!pattern) return;
      const project = Core.createProjectFromLibraryPattern(pattern);
      setProject(project, true);
      switchView("editor");
      setStatus(`已载入：${project.title}`);
    });
  });
}

function libraryCardHtml(pattern) {
  const cells = pattern.cells.map((cell) => (
    `<span class="library-cell" style="background:${cell.isTransparent ? "transparent" : cell.hex}"></span>`
  )).join("");
  const tags = [pattern.category, pattern.difficulty, pattern.sourceType === "built-in" ? "原创" : "导入"]
    .filter(Boolean)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <button class="library-card" data-pattern-id="${escapeAttribute(pattern.id)}" type="button">
      <span class="library-preview" style="--cols:${pattern.gridWidth}">${cells}</span>
      <h3>${escapeHtml(pattern.title)}</h3>
      <p>${pattern.gridWidth}x${pattern.gridHeight} · ${pattern.sourceName || "本地图纸"}</p>
      <span class="library-meta">${tags}</span>
    </button>
  `;
}

async function importPatternPack(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.patterns)
        ? payload.patterns
        : [payload];
    const normalized = rawItems
      .map((item, index) => Core.normalizeLibraryPattern(item, {
        title: `${file.name.replace(/\.[^.]+$/, "") || "导入图纸"} ${index + 1}`
      }))
      .filter(Boolean)
      .map((item) => ({ ...item, sourceName: file.name, sourceType: "imported" }));

    if (!normalized.length) {
      setStatus("这个图纸包里没有识别到可用图纸。");
      return;
    }

    const existing = new Map((state.importedPatterns || []).map((item) => [item.id, item]));
    normalized.forEach((item) => existing.set(item.id, item));
    state.importedPatterns = Array.from(existing.values());
    saveImportedPatterns();
    renderLibraryCategories();
    renderLibrary();
    switchView("library");
    setStatus(`已导入 ${normalized.length} 张图纸。`);
  } catch (error) {
    setStatus("导入失败：请确认是拼豆小助手 JSON 图纸包。");
  } finally {
    event.target.value = "";
  }
}

function saveCurrentProjectToLibrary() {
  if (!state.currentProject) {
    setStatus("还没有可保存的图纸。");
    return;
  }
  const pattern = Core.projectToLibraryPattern(state.currentProject, {
    title: state.currentProject.title || "我的图纸"
  });
  const existing = new Map((state.importedPatterns || []).map((item) => [item.id, item]));
  existing.set(pattern.id, pattern);
  state.importedPatterns = Array.from(existing.values());
  saveImportedPatterns();
  renderLibraryCategories();
  renderLibrary();
  setStatus("已保存到本地图纸库。");
}

function saveImportedPatterns() {
  localStorage.setItem(STORAGE_KEYS.importedPatterns, JSON.stringify(state.importedPatterns || []));
}

function switchView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  if (viewName === "preview") renderPreview();
  if (viewName === "editor") renderProject();
  if (viewName === "guide") renderGuide();
  if (viewName === "library") renderLibrary();
}

function downloadProject() {
  const project = state.currentProject;
  if (!project) {
    setStatus("还没有可下载的图纸。");
    return;
  }

  const pages = Core.getExportPages(project, 50);
  pages.forEach((page, index) => {
    setTimeout(() => {
      Core.drawExportCanvas(els.workCanvas, project, { range: page });
      const suffix = pages.length > 1 ? `-p${page.index}` : "";
      downloadCanvas(els.workCanvas, `${safeFileName(project.title)}${suffix}.png`);
    }, index * 120);
  });
  setStatus(pages.length > 1 ? `已按 ${pages.length} 页导出 PNG。` : "已导出 PNG 图纸。");
}

function downloadCanvas(canvas, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function shareApp() {
  const shareData = {
    title: "拼豆小助手",
    text: "一个本地生成拼豆图纸的小工具，图片不上传服务器。",
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  if (navigator.clipboard) {
    await navigator.clipboard.writeText(window.location.href);
    setStatus("已复制分享链接。");
  } else {
    setStatus("复制这个页面地址就可以分享。");
  }
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function saveInventory() {
  localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(state.inventory));
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeFileName(value) {
  return (value || "pin-bead-pattern")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(fn, delay) {
  let timer = 0;
  return function debounced() {
    window.clearTimeout(timer);
    timer = window.setTimeout(fn, delay);
  };
}
