const assert = require("node:assert/strict");
const Core = require("../core.js");

function makeImageData(width, height, sampler) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((y * width) + x) * 4;
      const [r, g, b, a = 255] = sampler(x, y);
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return { data, width, height };
}

function testPaletteCounts() {
  assert.equal(Core.getPalette("mard").length, 221, "MARD palette should expose 221 colors");
  assert.equal(Core.getPalette("artkal").length, 221, "Artkal palette should expose 221 colors");

  ["mard", "artkal"].forEach((brand) => {
    [96, 120, 144, 168].forEach((count) => {
      const preset = Core.getPreset(brand, `${brand}-${count}`);
      const paletteIds = new Set(Core.getPalette(brand).map((color) => color.id));
      assert.equal(preset.colorIds.length, count, `${preset.id} should have ${count} colors`);
      preset.colorIds.forEach((id) => assert.ok(paletteIds.has(id), `${preset.id} contains unknown color ${id}`));
    });
  });
}

function testPatternGenerationUsesPresetOnly() {
  const imageData = makeImageData(18, 18, (x, y) => {
    if (x < 2 || y < 2 || x > 15 || y > 15) return [255, 255, 255, 255];
    if (x < 9) return [248, 150, 80, 255];
    return [60, 180, 220, 255];
  });
  const brand = "mard";
  const presetId = "mard-96";
  const palette = Core.getColorsForPreset(brand, presetId);
  const allowed = new Set(palette.map((color) => color.id));
  const project = Core.buildPatternFromImageData({
    imageData,
    brand,
    palettePresetId: presetId,
    palette,
    gridWidth: 18,
    gridHeight: 18,
    removeBackground: true,
    backgroundMode: "white"
  });

  assert.equal(project.gridWidth, 18);
  assert.equal(project.gridHeight, 18);
  assert.ok(project.totalBeads > 0, "pattern should keep subject pixels");
  const statTotal = project.colorStats.reduce((sum, item) => sum + item.count, 0);
  assert.equal(statTotal, project.totalBeads, "stats should sum to total bead count");
  project.colorStats.forEach((stat) => assert.ok(allowed.has(stat.colorId), `unexpected color ${stat.colorId}`));
}

function testCustomPaletteRestriction() {
  const brand = "mard";
  const customIds = ["A9", "C6", "H6"];
  const colors = Core.getColorsForPreset(brand, "mard-custom", customIds);
  assert.deepEqual(colors.map((color) => color.id), customIds);
}

function testClarityBoostPreservesThinDetails() {
  const imageData = makeImageData(160, 160, (x) => {
    if (x % 10 < 1) return [53, 55, 56, 255];
    return [255, 255, 251, 255];
  });
  const palette = Core.getColorsForPreset("mard", "mard-custom", ["H2", "H6"]);
  const normal = Core.buildPatternFromImageData({
    imageData,
    brand: "mard",
    palettePresetId: "mard-custom",
    palette,
    gridWidth: 16,
    gridHeight: 16,
    removeBackground: false
  });
  const sharp = Core.buildPatternFromImageData({
    imageData,
    brand: "mard",
    palettePresetId: "mard-custom",
    palette,
    gridWidth: 16,
    gridHeight: 16,
    removeBackground: false,
    clarityBoost: true
  });

  assert.equal(normal.cells[0].colorId, "H2", "plain averaging should treat a thin line as mostly light");
  assert.equal(sharp.cells[0].colorId, "H6", "clarity boost should preserve a high-contrast thin line");
}

function testImageEnhancementRaisesEdgeContrast() {
  const imageData = makeImageData(7, 7, (x) => {
    if (x === 3) return [80, 80, 80, 255];
    return [210, 210, 210, 255];
  });
  const enhanced = Core.enhanceImageData(imageData, { strength: 0.8 });
  const darkIndex = ((3 * enhanced.width) + 3) * 4;
  const lightIndex = ((3 * enhanced.width) + 1) * 4;
  const beforeContrast = 210 - 80;
  const afterContrast = enhanced.data[lightIndex] - enhanced.data[darkIndex];

  assert.ok(afterContrast > beforeContrast, "image enhancement should increase edge contrast before bead sampling");
}

function testImageEnhancementKeepsFlatColor() {
  const imageData = makeImageData(5, 5, () => [120, 160, 200, 255]);
  const enhanced = Core.enhanceImageData(imageData, { strength: 0.9 });
  for (let index = 0; index < enhanced.data.length; index += 4) {
    assert.equal(enhanced.data[index], 120, "flat red channel should stay unchanged");
    assert.equal(enhanced.data[index + 1], 160, "flat green channel should stay unchanged");
    assert.equal(enhanced.data[index + 2], 200, "flat blue channel should stay unchanged");
    assert.equal(enhanced.data[index + 3], 255, "alpha should stay unchanged");
  }
}

function testSubjectCropFindsForegroundBounds() {
  const imageData = makeImageData(100, 80, (x, y) => {
    if (x >= 20 && x <= 69 && y >= 10 && y <= 59) return [40, 40, 40, 255];
    return [255, 255, 255, 255];
  });
  const crop = Core.estimateSubjectCrop(imageData, { backgroundMode: "white" });

  assert.ok(crop.confidence > 0.3, "subject crop should be confident on a clean white background");
  assert.ok(crop.x > 0.1 && crop.x < 0.25, "subject crop should start near the foreground left edge");
  assert.ok(crop.y >= 0 && crop.y < 0.16, "subject crop should start near the foreground top edge");
  assert.ok(crop.width < 0.7, "subject crop should be tighter than the full image width");
  assert.ok(crop.height < 0.75, "subject crop should be tighter than the full image height");
}

function testAutoGridKeepsSmallPixelArtSize() {
  const size = Core.estimateGridSize(58, 58, 36, { autoTarget: true });
  const largerSize = Core.estimateGridSize(150, 120, 36, { autoTarget: true, maxLongSide: 160 });
  assert.equal(size.gridWidth, 58, "small pixel-art uploads should keep source width as bead width");
  assert.equal(size.gridHeight, 58, "small pixel-art uploads should keep source height as bead height");
  assert.equal(largerSize.gridWidth, 150, "pixel-art uploads within the UI limit should keep source width");
  assert.equal(largerSize.gridHeight, 120, "pixel-art uploads within the UI limit should keep source height");
}

function testAutoGridUsesImageDetail() {
  const flat = makeImageData(100, 100, () => [180, 180, 180, 255]);
  const detailed = makeImageData(100, 100, (x, y) => (
    (x + y) % 2 === 0 ? [30, 30, 30, 255] : [235, 235, 235, 255]
  ));
  const flatScore = Core.estimateImageDetail(flat);
  const detailedScore = Core.estimateImageDetail(detailed);
  const flatSize = Core.estimateGridSize(1200, 1200, null, { autoTarget: true, detailScore: flatScore });
  const detailedSize = Core.estimateGridSize(1200, 1200, null, { autoTarget: true, detailScore: detailedScore });

  assert.ok(detailedScore > flatScore, "detail scoring should detect edge-heavy images");
  assert.ok(detailedSize.gridWidth > flatSize.gridWidth, "auto grid should suggest more beads for detailed images");
}

function testGuideSections() {
  const imageData = makeImageData(32, 24, (x, y) => {
    if (x < 4 || y < 4 || x > 27 || y > 19) return [255, 255, 255, 255];
    if (x < 14) return [55, 55, 55, 255];
    if (y < 12) return [248, 150, 80, 255];
    return [70, 184, 223, 255];
  });
  const palette = Core.getColorsForPreset("mard", "mard-120");
  const project = Core.buildPatternFromImageData({
    imageData,
    brand: "mard",
    palettePresetId: "mard-120",
    palette,
    gridWidth: 32,
    gridHeight: 24,
    removeBackground: true,
    backgroundMode: "white"
  });
  const sections = Core.buildGuideSections(project, { blockSize: 8 });
  const ids = new Set(sections.map((section) => section.id));
  const sectionTotal = sections.reduce((sum, section) => sum + section.totalBeads, 0);

  assert.ok(sections.length > 1, "guide should split a project into workable sections");
  assert.equal(ids.size, sections.length, "guide section ids should be unique");
  assert.equal(sectionTotal, project.totalBeads, "guide sections should cover every bead once");
  sections.forEach((section) => {
    assert.ok(section.x >= 0 && section.y >= 0, "section should start inside the grid");
    assert.ok(section.x + section.width <= project.gridWidth, "section width should stay inside the grid");
    assert.ok(section.y + section.height <= project.gridHeight, "section height should stay inside the grid");
    assert.ok(section.colorPlan.length > 0, "section should expose a color plan");
    assert.equal(section.colorStats.reduce((sum, stat) => sum + stat.count, 0), section.totalBeads);
  });
}

function makeChartImageData(matrix, cellSize, options = {}) {
  const gridHeight = matrix.length;
  const gridWidth = matrix[0].length;
  const width = gridWidth * cellSize + 1;
  const height = gridHeight * cellSize + 1;
  const map = Core.getPaletteMap("mard");
  return makeImageData(width, height, (x, y) => {
    if (x % cellSize === 0 || y % cellSize === 0) return [188, 188, 198, 255];
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const colorId = matrix[cellY][cellX];
    const localX = x % cellSize;
    const localY = y % cellSize;
    if (!colorId) {
      if (options.watermark && Math.abs((localY - localX) - 2) <= 1) return [160, 160, 160, 255];
      return [255, 255, 255, 255];
    }
    const color = map[colorId];
    const isText = localX > cellSize * 0.34 && localX < cellSize * 0.66 && localY > cellSize * 0.34 && localY < cellSize * 0.66;
    if (isText) {
      return colorId === "H6" ? [255, 255, 255, 255] : [20, 20, 20, 255];
    }
    return color.rgb.concat(255);
  });
}

function testChartRecognition() {
  const matrix = [
    ["", "H6", "A9", ""],
    ["H2", "A1", "C6", ""],
    ["", "G13", "B13", "H4"]
  ];
  const imageData = makeChartImageData(matrix, 20, { watermark: true });
  const estimate = Core.estimateChartGrid(imageData);
  assert.equal(estimate.gridWidth, 4, "grid estimator should recover chart width");
  assert.equal(estimate.gridHeight, 3, "grid estimator should recover chart height");

  const project = Core.recognizePatternChart({
    imageData,
    brand: "mard",
    palettePresetId: "mard-120",
    palette: Core.getColorsForPreset("mard", "mard-120"),
    gridWidth: 4,
    gridHeight: 3,
    ignoreWatermark: true
  });
  const stats = new Map(project.colorStats.map((stat) => [stat.colorId, stat.count]));
  assert.equal(project.totalBeads, 8, "chart recognition should skip blank cells");
  assert.equal(stats.get("H2"), 1, "chart recognition should keep white H2 cells with text");
  assert.equal(stats.get("H6"), 1, "chart recognition should keep dark outline cells");
  assert.equal(project.cells.filter((cell) => cell.isTransparent).length, 4);
}

function testLocalLibraryPatterns() {
  assert.ok(Core.LOCAL_LIBRARY_PATTERNS.length >= 24, "local library should include many built-in patterns");
  const pattern = Core.LOCAL_LIBRARY_PATTERNS[0];
  const project = Core.createProjectFromLibraryPattern(pattern);
  assert.equal(project.gridWidth, pattern.gridWidth);
  assert.equal(project.gridHeight, pattern.gridHeight);
  assert.ok(project.totalBeads > 0, "built-in pattern should create a project");
}

function testLibraryPatternNormalization() {
  const pattern = Core.normalizeLibraryPattern({
    title: "导入测试",
    brand: "mard",
    palettePresetId: "mard-120",
    gridWidth: 2,
    gridHeight: 2,
    cells: [
      { x: 0, y: 0, colorId: "A9" },
      { x: 1, y: 0, colorId: "" },
      { x: 0, y: 1, colorId: "H6" },
      { x: 1, y: 1, colorId: "C6" }
    ]
  });
  assert.ok(pattern, "valid project-like JSON should normalize");
  assert.equal(pattern.cells.filter((cell) => !cell.isTransparent).length, 3);
  const saved = Core.projectToLibraryPattern(Core.createProjectFromLibraryPattern(pattern), { title: "保存测试" });
  assert.equal(saved.title, "保存测试");
  assert.equal(saved.gridWidth, 2);
}

function testExportPagesSkipEmptyBlocks() {
  const pattern = Core.normalizeLibraryPattern({
    title: "分块导出测试",
    brand: "mard",
    palettePresetId: "mard-120",
    gridWidth: 58,
    gridHeight: 58,
    cells: Array.from({ length: 58 * 58 }, (_, index) => {
      const x = index % 58;
      const y = Math.floor(index / 58);
      const colorId = x < 29 && y < 29 ? "A9" : "";
      return { x, y, colorId };
    })
  });
  const project = Core.createProjectFromLibraryPattern(pattern);
  const pages = Core.getExportPages(project, 29);

  assert.equal(pages.length, 1, "export pages should skip empty board blocks");
  assert.equal(pages[0].x, 0);
  assert.equal(pages[0].y, 0);
  assert.equal(pages[0].totalBeads, 29 * 29);
  assert.deepEqual(pages[0].colorStats.map((stat) => [stat.colorId, stat.count]), [["A9", 29 * 29]]);
}

testPaletteCounts();
testPatternGenerationUsesPresetOnly();
testCustomPaletteRestriction();
testClarityBoostPreservesThinDetails();
testImageEnhancementRaisesEdgeContrast();
testImageEnhancementKeepsFlatColor();
testSubjectCropFindsForegroundBounds();
testAutoGridKeepsSmallPixelArtSize();
testAutoGridUsesImageDetail();
testGuideSections();
testChartRecognition();
testLocalLibraryPatterns();
testLibraryPatternNormalization();
testExportPagesSkipEmptyBlocks();

console.log("All tests passed");
