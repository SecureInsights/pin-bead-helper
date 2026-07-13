(function attachCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.PinBeanCore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  const FAMILY_DEFS = [
    ["A", 26, [255, 246, 212], [238, 87, 64], "warm"],
    ["B", 31, [255, 235, 80], [31, 105, 97], "green"],
    ["C", 29, [154, 219, 208], [44, 49, 107], "blue"],
    ["D", 26, [109, 98, 174], [70, 35, 86], "purple"],
    ["E", 24, [234, 197, 218], [190, 36, 63], "pink"],
    ["F", 25, [255, 233, 217], [216, 105, 92], "skin"],
    ["G", 21, [248, 223, 193], [94, 69, 58], "brown"],
    ["H", 23, [255, 255, 255], [53, 55, 56], "neutral"],
    ["M", 16, [227, 246, 249], [96, 103, 160], "pastel"]
  ];

  const OVERRIDES = {
    A1: [255, 246, 212],
    A9: [249, 151, 86],
    B13: [190, 216, 84],
    B17: [101, 134, 47],
    C6: [70, 184, 223],
    D3: [64, 44, 117],
    D15: [74, 47, 103],
    E10: [241, 167, 196],
    E14: [213, 51, 110],
    G8: [97, 56, 48],
    G9: [220, 173, 128],
    G13: [130, 74, 55],
    H1: [255, 255, 255],
    H2: [255, 255, 251],
    H4: [189, 190, 190],
    H6: [53, 55, 56]
  };

  function lerp(start, end, amount) {
    return Math.round(start + ((end - start) * amount));
  }

  function mixRgb(a, b, amount) {
    return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount), lerp(a[2], b[2], amount)];
  }

  function familyRgb(start, end, index, total, family) {
    const t = total <= 1 ? 0 : index / (total - 1);
    const base = mixRgb(start, end, t);
    if (family === "green") {
      base[1] = clamp(base[1] + Math.sin(t * Math.PI) * 38, 0, 255);
    }
    if (family === "blue") {
      base[2] = clamp(base[2] + Math.sin(t * Math.PI) * 52, 0, 255);
    }
    if (family === "pink") {
      base[0] = clamp(base[0] + Math.sin(t * Math.PI) * 24, 0, 255);
    }
    if (family === "neutral") {
      const v = lerp(255, 53, t);
      return [v, v, v];
    }
    return base;
  }

  function createPalette(brand) {
    const colors = [];
    FAMILY_DEFS.forEach(([letter, count, start, end, tag]) => {
      for (let i = 1; i <= count; i += 1) {
        const shortId = `${letter}${i}`;
        const id = brand === "artkal" ? `M${shortId}` : shortId;
        const rgb = OVERRIDES[shortId] || familyRgb(start, end, i - 1, count, tag);
        colors.push({
          id,
          shortId,
          brand,
          name: id,
          hex: rgbToHex(rgb),
          rgb,
          order: colors.length + 1,
          isTransparent: shortId === "H1",
          tags: shortId === "H1" ? ["transparent", tag] : [tag]
        });
      }
    });
    return colors;
  }

  const PALETTES = {
    mard: createPalette("mard"),
    artkal: createPalette("artkal")
  };

  const CORE_SHORT_IDS = [
    "A1", "A4", "A7", "A9", "A12", "A17", "B1", "B8", "B13", "B17",
    "B21", "C1", "C6", "C11", "C20", "D3", "D7", "D15", "E3", "E7",
    "E10", "E14", "F2", "F7", "F13", "G3", "G8", "G9", "G13", "H2",
    "H3", "H4", "H5", "H6", "H13", "M2", "M12"
  ];

  const PRESETS = {
    mard: buildPresets("mard"),
    artkal: buildPresets("artkal")
  };

  const LOCAL_LIBRARY_PATTERNS = createLocalLibraryPatterns();

  function convertShortId(shortId, brand) {
    return brand === "artkal" ? `M${shortId}` : shortId;
  }

  function buildPresets(brand) {
    return [
      preset(brand, "all", 221, "221 全色", getPalette(brand).map((color) => color.id), "完整色卡，优先还原度。"),
      preset(brand, "96", 96, "96 色套餐", buildBalancedSet(brand, 96), "常用色优先，适合入门盒。"),
      preset(brand, "120", 120, "120 色套餐", buildBalancedSet(brand, 120), "参考图常见规格。"),
      preset(brand, "144", 144, "144 色套餐", buildBalancedSet(brand, 144), "渐变和肤色更稳。"),
      preset(brand, "168", 168, "168 色套餐", buildBalancedSet(brand, 168), "面向大盒配置。"),
      preset(brand, "custom", 0, "我的色库", [], "只使用已勾选色号。")
    ];
  }

  function preset(brand, slug, count, label, colorIds, description) {
    return {
      id: `${brand}-${slug}`,
      brand,
      name: `${brand === "artkal" ? "Artkal M" : "MARD"} ${label}`,
      count,
      colorIds,
      description
    };
  }

  function buildBalancedSet(brand, count) {
    const allShortIds = getPalette("mard")
      .filter((color) => !color.isTransparent)
      .map((color) => color.shortId);
    const selected = [];
    const seen = new Set();

    CORE_SHORT_IDS.forEach((shortId) => {
      if (selected.length < count && !seen.has(shortId)) {
        selected.push(shortId);
        seen.add(shortId);
      }
    });

    const needed = count - selected.length;
    for (let i = 0; i < needed; i += 1) {
      const index = Math.round((i * (allShortIds.length - 1)) / Math.max(needed - 1, 1));
      const shortId = allShortIds[index];
      if (!seen.has(shortId)) {
        selected.push(shortId);
        seen.add(shortId);
      }
    }

    for (let i = 0; selected.length < count && i < allShortIds.length; i += 1) {
      const shortId = allShortIds[i];
      if (!seen.has(shortId)) {
        selected.push(shortId);
        seen.add(shortId);
      }
    }

    selected.sort((a, b) => shortIdOrder(a) - shortIdOrder(b));
    return selected.map((shortId) => convertShortId(shortId, brand));
  }

  function shortIdOrder(shortId) {
    const match = /^([A-Z]+)(\d+)$/.exec(shortId);
    if (!match) return 9999;
    const letterScore = match[1].charCodeAt(0) * 1000;
    return letterScore + Number(match[2]);
  }

  function getPalette(brand) {
    return PALETTES[brand] || PALETTES.mard;
  }

  function getPreset(brand, presetId, customIds) {
    const presets = PRESETS[brand] || PRESETS.mard;
    const preset = presets.find((item) => item.id === presetId) || presets[2];
    if (preset.id.endsWith("-custom")) {
      return { ...preset, colorIds: customIds || [], count: (customIds || []).length };
    }
    return preset;
  }

  function getPaletteMap(brand) {
    return getPalette(brand).reduce((map, color) => {
      map[color.id] = color;
      map[color.shortId] = color;
      return map;
    }, {});
  }

  function getColorsForPreset(brand, presetId, customIds) {
    const map = getPaletteMap(brand);
    return getPreset(brand, presetId, customIds).colorIds.map((id) => map[id]).filter(Boolean);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rgbToHex(rgb) {
    return `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16)
    ];
  }

  function rgbToXyz(rgb) {
    let [r, g, b] = rgb.map((value) => value / 255);
    r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
    g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
    b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;
    return [
      (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100,
      (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100,
      (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100
    ];
  }

  function xyzToLab(xyz) {
    let [x, y, z] = xyz;
    x /= 95.047;
    y /= 100;
    z /= 108.883;
    [x, y, z] = [x, y, z].map((value) => (
      value > 0.008856 ? value ** (1 / 3) : (7.787 * value) + (16 / 116)
    ));
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
  }

  function rgbToLab(rgb) {
    return xyzToLab(rgbToXyz(rgb));
  }

  function deltaE(labA, labB) {
    return Math.sqrt(
      ((labA[0] - labB[0]) ** 2) +
      ((labA[1] - labB[1]) ** 2) +
      ((labA[2] - labB[2]) ** 2)
    );
  }

  function withLab(colors) {
    return colors
      .filter((color) => !color.isTransparent)
      .map((color) => ({ ...color, lab: color.lab || rgbToLab(color.rgb) }));
  }

  function nearestColor(rgb, paletteWithLab) {
    const lab = rgbToLab(rgb);
    let best = paletteWithLab[0];
    let bestDistance = Infinity;
    paletteWithLab.forEach((color) => {
      const distance = deltaE(lab, color.lab);
      if (distance < bestDistance) {
        best = color;
        bestDistance = distance;
      }
    });
    return { color: best, distance: bestDistance };
  }

  function luminance(rgb) {
    return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
  }

  function colorDistance(rgbA, rgbB) {
    return Math.sqrt(
      ((rgbA[0] - rgbB[0]) ** 2) +
      ((rgbA[1] - rgbB[1]) ** 2) +
      ((rgbA[2] - rgbB[2]) ** 2)
    );
  }

  function estimateImageDetail(imageData) {
    const data = imageData && imageData.data;
    const width = imageData && imageData.width;
    const height = imageData && imageData.height;
    if (!data || !width || !height || width < 2 || height < 2) return 0;

    const stepX = Math.max(1, Math.floor(width / 120));
    const stepY = Math.max(1, Math.floor(height / 120));
    const buckets = new Set();
    let samples = 0;
    let edgeTotal = 0;
    let edgeHits = 0;

    for (let y = 0; y < height - 1; y += stepY) {
      for (let x = 0; x < width - 1; x += stepX) {
        const index = ((y * width) + x) * 4;
        const right = ((y * width) + Math.min(width - 1, x + stepX)) * 4;
        const down = ((Math.min(height - 1, y + stepY) * width) + x) * 4;
        const rgb = [data[index], data[index + 1], data[index + 2]];
        const hereLuma = luminance(rgb);
        const rightLuma = luminance([data[right], data[right + 1], data[right + 2]]);
        const downLuma = luminance([data[down], data[down + 1], data[down + 2]]);
        const edge = Math.max(Math.abs(hereLuma - rightLuma), Math.abs(hereLuma - downLuma));

        edgeTotal += Math.min(edge / 72, 1);
        if (edge > 18) edgeHits += 1;
        buckets.add(`${data[index] >> 5}-${data[index + 1] >> 5}-${data[index + 2] >> 5}`);
        samples += 1;
      }
    }

    if (!samples) return 0;
    const meanEdge = edgeTotal / samples;
    const edgeRatio = edgeHits / samples;
    const colorVariety = Math.min(1, buckets.size / Math.max(8, Math.sqrt(samples)));
    return clamp((edgeRatio * 0.52) + (meanEdge * 0.34) + (colorVariety * 0.14), 0, 1);
  }

  function estimateAutoLongSide(imageWidth, imageHeight, options) {
    const imageLongSide = Math.max(imageWidth, imageHeight);
    const maxLongSide = options.maxLongSide || 120;
    const minLongSide = options.minLongSide || 16;
    const detailScore = clamp(options.detailScore || 0, 0, 1);
    const pixelBonus = imageLongSide >= 2400 ? 16 : imageLongSide >= 1200 ? 10 : imageLongSide >= 640 ? 6 : 0;
    const target = 48 + pixelBonus + Math.round(detailScore * 34);
    return clamp(Math.round(target / 2) * 2, minLongSide, maxLongSide);
  }

  function estimateGridSize(imageWidth, imageHeight, targetLongSide, options = {}) {
    if (!imageWidth || !imageHeight) {
      return { gridWidth: 36, gridHeight: 36 };
    }

    const maxLongSide = options.maxLongSide || 120;
    const minLongSide = options.minLongSide || 16;
    const imageLongSide = Math.max(imageWidth, imageHeight);
    const preserveSourcePixels = options.preserveSourcePixels !== false;
    const target = options.autoTarget
      ? estimateAutoLongSide(imageWidth, imageHeight, options)
      : (targetLongSide || 48);
    const longSide = preserveSourcePixels && imageLongSide >= minLongSide && imageLongSide <= maxLongSide
      ? imageLongSide
      : clamp(target, minLongSide, maxLongSide);
    const scale = longSide / imageLongSide;

    return {
      gridWidth: clamp(Math.round(imageWidth * scale), 1, maxLongSide),
      gridHeight: clamp(Math.round(imageHeight * scale), 1, maxLongSide)
    };
  }

  function getPixel(data, width, x, y) {
    const index = ((y * width) + x) * 4;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  }

  function averageCornerColor(data, width, height) {
    const points = [
      [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
      [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
      [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)]
    ];
    const total = [0, 0, 0];
    points.forEach(([x, y]) => {
      const [r, g, b] = getPixel(data, width, x, y);
      total[0] += r;
      total[1] += g;
      total[2] += b;
    });
    return total.map((value) => Math.round(value / points.length));
  }

  function resolveBackgroundMode(backgroundMode, backgroundRgb) {
    if (backgroundMode === "white" || backgroundMode === "black") {
      return backgroundMode;
    }
    return luminance(backgroundRgb) > 128 ? "white" : "black";
  }

  function findSubjectBounds(data, width, height, backgroundRgb, mode) {
    const threshold = mode === "white" ? 34 : 42;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = getPixel(data, width, x, y);
        if (a > 24 && colorDistance([r, g, b], backgroundRgb) > threshold) {
          found = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!found) return { x: 0, y: 0, width, height };
    const padX = Math.ceil(width * 0.025);
    const padY = Math.ceil(height * 0.025);
    const x = Math.max(0, minX - padX);
    const y = Math.max(0, minY - padY);
    return {
      x,
      y,
      width: Math.min(width - 1, maxX + padX) - x + 1,
      height: Math.min(height - 1, maxY + padY) - y + 1
    };
  }

  function estimateSubjectCrop(imageData, options) {
    const data = imageData.data || imageData;
    const width = imageData.width || (options && options.width);
    const height = imageData.height || (options && options.height);
    if (!width || !height) {
      return { x: 0, y: 0, width: 1, height: 1, confidence: 0 };
    }

    const backgroundRgb = averageCornerColor(data, width, height);
    const backgroundMode = resolveBackgroundMode((options && options.backgroundMode) || "auto", backgroundRgb);
    const bounds = findSubjectBounds(data, width, height, backgroundRgb, backgroundMode);
    const isFullFrame = bounds.x <= 1 &&
      bounds.y <= 1 &&
      bounds.x + bounds.width >= width - 1 &&
      bounds.y + bounds.height >= height - 1;
    const areaRatio = (bounds.width * bounds.height) / Math.max(1, width * height);

    return {
      x: bounds.x / width,
      y: bounds.y / height,
      width: bounds.width / width,
      height: bounds.height / height,
      backgroundMode,
      confidence: isFullFrame ? 0.2 : clamp(1 - areaRatio, 0.2, 0.95)
    };
  }

  function enhanceImageData(imageData, options) {
    const data = imageData.data || imageData;
    const width = imageData.width || (options && options.width);
    const height = imageData.height || (options && options.height);
    const strength = clamp(Number(options && options.strength) || 0.62, 0, 1);
    if (!data || !width || !height || strength <= 0) {
      return imageData;
    }

    const output = new Uint8ClampedArray(data.length);
    const sharpness = strength * 0.72;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = ((y * width) + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        if (a < 24) {
          output[index] = r;
          output[index + 1] = g;
          output[index + 2] = b;
          output[index + 3] = a;
          continue;
        }

        const blur = [0, 0, 0];
        let count = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = clamp(x + ox, 0, width - 1);
            const ny = clamp(y + oy, 0, height - 1);
            const neighbor = ((ny * width) + nx) * 4;
            blur[0] += data[neighbor];
            blur[1] += data[neighbor + 1];
            blur[2] += data[neighbor + 2];
            count += 1;
          }
        }
        blur[0] /= count;
        blur[1] /= count;
        blur[2] /= count;

        [r, g, b].forEach((value, channel) => {
          const sharpened = value + (value - blur[channel]) * sharpness;
          output[index + channel] = clamp(Math.round(sharpened), 0, 255);
        });
        output[index + 3] = a;
      }
    }

    return { data: output, width, height };
  }

  function isBackgroundPixel(rgb, alpha, backgroundRgb, removeBackground, threshold) {
    return removeBackground && (alpha < 24 || colorDistance(rgb, backgroundRgb) <= threshold);
  }

  function samplePixelLuminance(data, imageWidth, imageHeight, x, y) {
    const safeX = clamp(x, 0, imageWidth - 1);
    const safeY = clamp(y, 0, imageHeight - 1);
    const [r, g, b] = getPixel(data, imageWidth, safeX, safeY);
    return luminance([r, g, b]);
  }

  function boostRgbClarity(rgb, strength) {
    return rgb.map((value) => Math.round(clamp(value, 0, 255)));
  }

  function detailWeightedCellAverage(data, imageWidth, imageHeight, startX, endX, startY, endY, backgroundRgb, removeBackground, threshold, average, count, strength) {
    const avgLum = luminance(average);
    const weighted = [0, 0, 0];
    const darkTotal = [0, 0, 0];
    const lightTotal = [0, 0, 0];
    let weightSum = 0;
    let darkCount = 0;
    let lightCount = 0;

    for (let y = startY; y < endY && y < imageHeight; y += 1) {
      for (let x = startX; x < endX && x < imageWidth; x += 1) {
        const [r, g, b, a] = getPixel(data, imageWidth, x, y);
        const rgb = [r, g, b];
        if (isBackgroundPixel(rgb, a, backgroundRgb, removeBackground, threshold)) continue;

        const lum = luminance(rgb);
        const edge = (
          Math.abs(lum - samplePixelLuminance(data, imageWidth, imageHeight, x - 1, y)) +
          Math.abs(lum - samplePixelLuminance(data, imageWidth, imageHeight, x + 1, y)) +
          Math.abs(lum - samplePixelLuminance(data, imageWidth, imageHeight, x, y - 1)) +
          Math.abs(lum - samplePixelLuminance(data, imageWidth, imageHeight, x, y + 1))
        ) / 4;
        const contrast = Math.abs(lum - avgLum);
        const weight = 1 + (strength * (Math.min(3.2, contrast / 34) + Math.min(2.4, edge / 42)));

        weighted[0] += r * weight;
        weighted[1] += g * weight;
        weighted[2] += b * weight;
        weightSum += weight;

        if (lum < avgLum - 48) {
          darkTotal[0] += r;
          darkTotal[1] += g;
          darkTotal[2] += b;
          darkCount += 1;
        } else if (lum > avgLum + 48) {
          lightTotal[0] += r;
          lightTotal[1] += g;
          lightTotal[2] += b;
          lightCount += 1;
        }
      }
    }

    if (!weightSum) return average;

    let result = weighted.map((value) => value / weightSum);
    const darkRatio = darkCount / count;
    const lightRatio = lightCount / count;
    let detailRgb = null;

    if (darkRatio >= 0.1 && darkRatio <= 0.45 && avgLum > 105) {
      detailRgb = darkTotal.map((value) => value / darkCount);
    } else if (lightRatio >= 0.1 && lightRatio <= 0.45 && avgLum < 150) {
      detailRgb = lightTotal.map((value) => value / lightCount);
    }

    if (detailRgb) {
      const blend = Math.min(0.72, 0.46 + (strength * 0.34));
      result = result.map((value, index) => value + ((detailRgb[index] - value) * blend));
    }

    return boostRgbClarity(result, strength);
  }

  function averageCell(data, imageWidth, imageHeight, bounds, cellX, cellY, gridWidth, gridHeight, backgroundRgb, removeBackground, mode, options) {
    const startX = Math.floor(bounds.x + (cellX * bounds.width / gridWidth));
    const endX = Math.max(startX + 1, Math.floor(bounds.x + ((cellX + 1) * bounds.width / gridWidth)));
    const startY = Math.floor(bounds.y + (cellY * bounds.height / gridHeight));
    const endY = Math.max(startY + 1, Math.floor(bounds.y + ((cellY + 1) * bounds.height / gridHeight)));
    const total = [0, 0, 0];
    let count = 0;
    let skipped = 0;
    const threshold = mode === "white" ? 34 : 42;
    const clarityBoost = Boolean(options && options.clarityBoost);
    const clarityStrength = clamp(Number(options && options.clarityStrength) || 0.72, 0, 1);
    for (let y = startY; y < endY && y < imageHeight; y += 1) {
      for (let x = startX; x < endX && x < imageWidth; x += 1) {
        const [r, g, b, a] = getPixel(data, imageWidth, x, y);
        const isBackground = isBackgroundPixel([r, g, b], a, backgroundRgb, removeBackground, threshold);
        if (isBackground) {
          skipped += 1;
        } else {
          total[0] += r;
          total[1] += g;
          total[2] += b;
          count += 1;
        }
      }
    }
    if (count === 0 || skipped > count * (clarityBoost ? 8 : 4)) return null;

    const average = total.map((value) => Math.round(value / count));
    if (!clarityBoost || count < 3) return average;
    return detailWeightedCellAverage(
      data,
      imageWidth,
      imageHeight,
      startX,
      endX,
      startY,
      endY,
      backgroundRgb,
      removeBackground,
      threshold,
      average,
      count,
      clarityStrength
    );
  }

  function averageRegion(data, imageWidth, imageHeight, left, top, width, height, options) {
    const total = [0, 0, 0];
    let count = 0;
    const skipCenter = options && options.skipCenter;
    const skipLightGrid = options && options.skipLightGrid;
    const startX = clamp(Math.floor(left), 0, imageWidth - 1);
    const endX = clamp(Math.ceil(left + width), startX + 1, imageWidth);
    const startY = clamp(Math.floor(top), 0, imageHeight - 1);
    const endY = clamp(Math.ceil(top + height), startY + 1, imageHeight);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const rx = (x - left) / Math.max(width, 1);
        const ry = (y - top) / Math.max(height, 1);
        if (rx < 0.12 || rx > 0.88 || ry < 0.12 || ry > 0.88) continue;
        if (skipCenter && rx > 0.32 && rx < 0.68 && ry > 0.28 && ry < 0.72) continue;
        const [r, g, b, a] = getPixel(data, imageWidth, x, y);
        if (a < 24) continue;
        const rgb = [r, g, b];
        if (options && options.ignoreWatermark && isWatermarkPixel(rgb)) continue;
        if (skipLightGrid && isLightGridPixel(rgb) && (rx < 0.18 || rx > 0.82 || ry < 0.18 || ry > 0.82)) continue;
        total[0] += r;
        total[1] += g;
        total[2] += b;
        count += 1;
      }
    }

    if (!count) return null;
    return total.map((value) => Math.round(value / count));
  }

  function buildPatternFromImageData(options) {
    const imageData = options.imageData;
    const data = imageData.data || imageData;
    const width = imageData.width || options.width;
    const height = imageData.height || options.height;
    const gridWidth = clamp(Number(options.gridWidth) || 36, 16, 120);
    const gridHeight = clamp(Number(options.gridHeight) || 36, 16, 120);
    const palette = withLab(options.palette || getColorsForPreset("mard", "mard-120"));
    const backgroundRgb = averageCornerColor(data, width, height);
    const backgroundMode = resolveBackgroundMode(options.backgroundMode || "auto", backgroundRgb);
    const removeBackground = options.removeBackground !== false;
    const bounds = removeBackground ? findSubjectBounds(data, width, height, backgroundRgb, backgroundMode) : { x: 0, y: 0, width, height };
    const cells = [];
    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const average = averageCell(data, width, height, bounds, x, y, gridWidth, gridHeight, backgroundRgb, removeBackground, backgroundMode, {
          clarityBoost: options.clarityBoost === true,
          clarityStrength: options.clarityStrength
        });
        if (!average) {
          cells.push({ x, y, colorId: "", hex: "transparent", rgb: [255, 255, 255], isTransparent: true });
        } else {
          const match = nearestColor(average, palette);
          cells.push({
            x,
            y,
            colorId: match.color.id,
            shortId: match.color.shortId,
            hex: match.color.hex,
            rgb: match.color.rgb,
            isTransparent: false,
            distance: Math.round(match.distance * 100) / 100
          });
        }
      }
    }
    return finalizeProject({
      id: createId("project"),
      title: options.title || "拼豆图纸",
      brand: options.brand || "mard",
      palettePresetId: options.palettePresetId || "mard-120",
      gridWidth,
      gridHeight,
      backgroundMode,
      removeBackground,
      bounds,
      cells,
      createdAt: Date.now(),
      sourceName: options.sourceName || ""
    });
  }

  function recognizePatternChart(options) {
    const imageData = options.imageData;
    const data = imageData.data || imageData;
    const imageWidth = imageData.width || options.width;
    const imageHeight = imageData.height || options.height;
    const gridWidth = clamp(Number(options.gridWidth) || 36, 1, 160);
    const gridHeight = clamp(Number(options.gridHeight) || 36, 1, 160);
    const brand = options.brand || "mard";
    const palette = withLab(options.palette || getColorsForPreset(brand, `${brand}-120`));
    const map = getPaletteMap(brand);
    const bounds = options.bounds || { x: 0, y: 0, width: imageWidth, height: imageHeight };
    const ignoreWatermark = options.ignoreWatermark !== false;
    const cells = [];
    let recognizedBeadCells = 0;
    let textOnlyLightCells = 0;

    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const left = bounds.x + (x * bounds.width / gridWidth);
        const top = bounds.y + (y * bounds.height / gridHeight);
        const width = bounds.width / gridWidth;
        const height = bounds.height / gridHeight;
        const sampled = sampleChartCell(data, imageWidth, imageHeight, left, top, width, height, { ignoreWatermark });

        if (!sampled || sampled.isTransparent) {
          cells.push({ x, y, colorId: "", hex: "transparent", rgb: [255, 255, 255], isTransparent: true });
          continue;
        }

        let match;
        if (sampled.forceShortId && map[sampled.forceShortId]) {
          match = { color: map[sampled.forceShortId], distance: 0 };
          textOnlyLightCells += 1;
        } else {
          match = nearestColor(sampled.rgb, palette);
        }

        recognizedBeadCells += 1;
        cells.push({
          x,
          y,
          colorId: match.color.id,
          shortId: match.color.shortId,
          hex: match.color.hex,
          rgb: match.color.rgb,
          isTransparent: false,
          distance: Math.round((match.distance || 0) * 100) / 100
        });
      }
    }

    return finalizeProject({
      id: createId("chart"),
      title: options.title || "识别图纸",
      brand,
      palettePresetId: options.palettePresetId || `${brand}-120`,
      gridWidth,
      gridHeight,
      cells,
      createdAt: Date.now(),
      sourceName: options.sourceName || "",
      recognition: {
        type: "chart",
        recognizedBeadCells,
        textOnlyLightCells,
        gridWidth,
        gridHeight
      }
    });
  }

  function sampleChartCell(data, imageWidth, imageHeight, left, top, width, height, options) {
    const ignoreWatermark = options && options.ignoreWatermark;
    const rgb = averageRegion(data, imageWidth, imageHeight, left, top, width, height, {
      skipCenter: true,
      skipLightGrid: true,
      ignoreWatermark
    }) || averageRegion(data, imageWidth, imageHeight, left, top, width, height, {
      skipCenter: true,
      skipLightGrid: true
    });
    const centerStats = countCellInk(data, imageWidth, imageHeight, left, top, width, height, { ignoreWatermark });
    if (!rgb) return null;

    const lum = luminance(rgb);
    const chroma = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
    const hasDarkText = centerStats.darkPixels > Math.max(4, centerStats.total * 0.015);
    const hasLightText = centerStats.lightPixels > Math.max(4, centerStats.total * 0.015);
    const isBlank = lum > 238 && chroma < 20 && !hasDarkText;

    if (isBlank) {
      return { isTransparent: true };
    }

    if (lum > 238 && chroma < 24 && hasDarkText) {
      return { rgb: [255, 255, 251], forceShortId: "H2", isTransparent: false };
    }

    return { rgb, isTransparent: false };
  }

  function countCellInk(data, imageWidth, imageHeight, left, top, width, height, options) {
    let darkPixels = 0;
    let lightPixels = 0;
    let total = 0;
    const startX = clamp(Math.floor(left + width * 0.28), 0, imageWidth - 1);
    const endX = clamp(Math.ceil(left + width * 0.72), startX + 1, imageWidth);
    const startY = clamp(Math.floor(top + height * 0.25), 0, imageHeight - 1);
    const endY = clamp(Math.ceil(top + height * 0.75), startY + 1, imageHeight);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const [r, g, b, a] = getPixel(data, imageWidth, x, y);
        if (a < 24) continue;
        const rgb = [r, g, b];
        if (options && options.ignoreWatermark && isWatermarkPixel(rgb)) continue;
        const lum = luminance(rgb);
        if (lum < 80) darkPixels += 1;
        if (lum > 235) lightPixels += 1;
        total += 1;
      }
    }

    return { darkPixels, lightPixels, total };
  }

  function isLightGridPixel(rgb) {
    const lum = luminance(rgb);
    const chroma = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
    return lum > 145 && lum < 242 && chroma < 34;
  }

  function isWatermarkPixel(rgb) {
    const lum = luminance(rgb);
    const chroma = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
    return lum > 88 && lum < 226 && chroma < 18;
  }

  function estimateChartGrid(imageData) {
    const data = imageData.data || imageData;
    const width = imageData.width;
    const height = imageData.height;
    const vertical = findRegularGridLines(scanGridScores(data, width, height, "vertical"));
    const horizontal = findRegularGridLines(scanGridScores(data, width, height, "horizontal"));

    if (!vertical.lines.length || !horizontal.lines.length) {
      return {
        gridWidth: 0,
        gridHeight: 0,
        crop: { x: 0, y: 0, width, height },
        confidence: 0
      };
    }

    const gridWidth = Math.max(0, vertical.lines.length - 1);
    const gridHeight = Math.max(0, horizontal.lines.length - 1);
    const crop = {
      x: Math.max(0, Math.round(vertical.lines[0])),
      y: Math.max(0, Math.round(horizontal.lines[0])),
      width: Math.min(width, Math.round(vertical.lines[vertical.lines.length - 1])) - Math.max(0, Math.round(vertical.lines[0])),
      height: Math.min(height, Math.round(horizontal.lines[horizontal.lines.length - 1])) - Math.max(0, Math.round(horizontal.lines[0]))
    };
    const confidence = Math.round(Math.min(vertical.confidence, horizontal.confidence) * 100) / 100;
    return { gridWidth, gridHeight, crop, confidence };
  }

  function scanGridScores(data, width, height, direction) {
    const limit = direction === "vertical" ? width : height;
    const cross = direction === "vertical" ? height : width;
    const scores = new Array(limit).fill(0);

    for (let i = 0; i < limit; i += 1) {
      let hits = 0;
      for (let j = 0; j < cross; j += 1) {
        const x = direction === "vertical" ? i : j;
        const y = direction === "vertical" ? j : i;
        const [r, g, b, a] = getPixel(data, width, x, y);
        if (a > 24 && isLightGridPixel([r, g, b])) hits += 1;
      }
      scores[i] = hits / cross;
    }
    return scores;
  }

  function findRegularGridLines(scores) {
    const threshold = Math.max(0.42, percentile(scores, 0.9) * 0.58);
    const groups = [];
    let start = -1;
    let weighted = 0;
    let total = 0;

    scores.forEach((score, index) => {
      if (score >= threshold) {
        if (start < 0) start = index;
        weighted += index * score;
        total += score;
      } else if (start >= 0) {
        groups.push({ center: total ? weighted / total : (start + index - 1) / 2, start, end: index - 1 });
        start = -1;
        weighted = 0;
        total = 0;
      }
    });
    if (start >= 0) {
      groups.push({ center: total ? weighted / total : (start + scores.length - 1) / 2, start, end: scores.length - 1 });
    }

    const centers = groups
      .map((group) => group.center)
      .filter((value, index, array) => index === 0 || value - array[index - 1] > 3);
    const diffs = centers
      .slice(1)
      .map((value, index) => value - centers[index])
      .filter((value) => value >= 8 && value <= 90);
    const spacing = median(diffs);
    if (!spacing) return { lines: [], confidence: 0 };

    const chains = [];
    let chain = [centers[0]];
    for (let i = 1; i < centers.length; i += 1) {
      const diff = centers[i] - centers[i - 1];
      if (diff >= spacing * 0.62 && diff <= spacing * 1.38) {
        chain.push(centers[i]);
      } else {
        if (chain.length >= 3) chains.push(chain);
        chain = [centers[i]];
      }
    }
    if (chain.length >= 3) chains.push(chain);

    const best = chains.sort((a, b) => b.length - a.length)[0] || [];
    const confidence = best.length ? Math.min(1, best.length / Math.max(8, centers.length)) : 0;
    return { lines: best, confidence };
  }

  function percentile(values, p) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
    return sorted[index];
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function summarizeCells(cells) {
    const map = {};
    cells.forEach((cell) => {
      if (cell.isTransparent || !cell.colorId) return;
      if (!map[cell.colorId]) {
        map[cell.colorId] = { colorId: cell.colorId, shortId: cell.shortId || cell.colorId.replace(/^M(?=[A-Z]\d)/, ""), hex: cell.hex, rgb: cell.rgb, count: 0 };
      }
      map[cell.colorId].count += 1;
    });
    return Object.keys(map)
      .map((id) => map[id])
      .sort((a, b) => b.count - a.count || a.colorId.localeCompare(b.colorId));
  }

  function finalizeProject(project) {
    const colorStats = summarizeCells(project.cells);
    return {
      ...project,
      colorStats,
      totalBeads: colorStats.reduce((sum, item) => sum + item.count, 0),
      updatedAt: Date.now()
    };
  }

  function createProjectFromLibraryPattern(pattern) {
    const normalized = normalizeLibraryPattern(pattern);
    if (!normalized) {
      throw new Error("图纸数据不可用");
    }
    return finalizeProject({
      id: createId(normalized.sourceType === "saved" ? "saved" : "library"),
      title: normalized.title,
      brand: normalized.brand,
      palettePresetId: normalized.palettePresetId,
      gridWidth: normalized.gridWidth,
      gridHeight: normalized.gridHeight,
      cells: normalized.cells.map((cell) => ({ ...cell })),
      sourceName: normalized.sourceName || "本地图纸库",
      sourceType: normalized.sourceType || "built-in",
      createdAt: Date.now()
    });
  }

  function normalizeLibraryPattern(input, fallback) {
    if (!input || !input.gridWidth || !input.gridHeight) return null;
    const brand = input.brand || (fallback && fallback.brand) || "mard";
    const map = getPaletteMap(brand);
    let cells = [];

    if (Array.isArray(input.cells)) {
      cells = input.cells.map((cell, index) => {
        const x = Number.isFinite(cell.x) ? cell.x : index % input.gridWidth;
        const y = Number.isFinite(cell.y) ? cell.y : Math.floor(index / input.gridWidth);
        const colorId = cell.colorId || "";
        const color = colorId ? map[colorId] : null;
        if (!color || cell.isTransparent || colorId === "transparent") {
          return { x, y, colorId: "", hex: "transparent", rgb: [255, 255, 255], isTransparent: true };
        }
        return {
          x,
          y,
          colorId: color.id,
          shortId: color.shortId,
          hex: color.hex,
          rgb: color.rgb,
          isTransparent: false
        };
      });
    } else if (Array.isArray(input.rows) && input.tokens) {
      input.rows.forEach((row, y) => {
        String(row).split("").forEach((token, x) => {
          const colorId = input.tokens[token] || "";
          const color = colorId ? map[colorId] : null;
          if (!color) {
            cells.push({ x, y, colorId: "", hex: "transparent", rgb: [255, 255, 255], isTransparent: true });
          } else {
            cells.push({ x, y, colorId: color.id, shortId: color.shortId, hex: color.hex, rgb: color.rgb, isTransparent: false });
          }
        });
      });
    }

    if (cells.length !== input.gridWidth * input.gridHeight) return null;

    return {
      id: input.id || createId("pattern"),
      title: input.title || (fallback && fallback.title) || "导入图纸",
      category: input.category || "自定义",
      difficulty: input.difficulty || "普通",
      tags: Array.isArray(input.tags) ? input.tags : [],
      brand,
      palettePresetId: input.palettePresetId || `${brand}-120`,
      gridWidth: Number(input.gridWidth),
      gridHeight: Number(input.gridHeight),
      sourceName: input.sourceName || "本地图纸",
      sourceType: input.sourceType || "imported",
      cells
    };
  }

  function projectToLibraryPattern(project, options) {
    return normalizeLibraryPattern({
      id: createId("saved-pattern"),
      title: options && options.title ? options.title : project.title || "保存的图纸",
      category: options && options.category ? options.category : "我的收藏",
      difficulty: options && options.difficulty ? options.difficulty : "自定义",
      tags: options && options.tags ? options.tags : ["我的图纸"],
      brand: project.brand || "mard",
      palettePresetId: project.palettePresetId || "mard-120",
      gridWidth: project.gridWidth,
      gridHeight: project.gridHeight,
      sourceName: "我的图库",
      sourceType: "saved",
      cells: project.cells
    });
  }

  function createLocalLibraryPatterns() {
    const bases = [
      ["heart", "爱心胸针", "胸针", ["爱心", "入门", "圆润"], 18, 18],
      ["bow", "蝴蝶结挂件", "挂件", ["蝴蝶结", "闪粉烫"], 20, 16],
      ["flower", "小花贴纸", "贴纸", ["小花", "植物"], 18, 18],
      ["tulip", "郁金香", "贴纸", ["花", "春天"], 18, 22],
      ["star", "小星星", "挂件", ["星星", "低格数"], 18, 18],
      ["moon", "月亮", "挂件", ["月亮", "夜空"], 18, 18],
      ["cloud", "奶油云朵", "贴纸", ["云朵", "可爱"], 22, 16],
      ["rainbow", "小彩虹", "摆件", ["彩虹", "多色"], 24, 16],
      ["apple", "红苹果", "贴纸", ["水果", "食物"], 18, 18],
      ["cherry", "双樱桃", "挂件", ["水果", "钥匙扣"], 20, 18],
      ["mushroom", "蘑菇屋", "摆件", ["蘑菇", "童话"], 20, 20],
      ["cat", "小猫脸", "胸针", ["动物", "猫"], 22, 20],
      ["bunny", "兔兔头", "胸针", ["动物", "兔子"], 20, 24],
      ["bear", "小熊头", "胸针", ["动物", "小熊"], 22, 20],
      ["fish", "小鱼", "挂件", ["动物", "海洋"], 22, 16]
    ];
    const variants = [
      { suffix: "", main: "A9", accent: "A1", dark: "H6", light: "H2", green: "B13", deep: "D3" },
      { suffix: " 轻甜款", main: "E10", accent: "A1", dark: "H6", light: "H2", green: "B17", deep: "C6" }
    ];

    return bases.flatMap(([shape, title, category, tags, gridWidth, gridHeight]) => (
      variants.map((variant, variantIndex) => {
        const design = {
          id: `${shape}-${variantIndex + 1}`,
          title: `${title}${variant.suffix}`,
          category,
          difficulty: gridWidth * gridHeight > 420 ? "进阶" : "入门",
          tags,
          gridWidth,
          gridHeight,
          shape,
          colors: variant
        };
        return normalizeLibraryPattern({
          ...design,
          brand: "mard",
          palettePresetId: "mard-120",
          sourceName: "原创内置图纸",
          sourceType: "built-in",
          cells: buildDesignCells(design)
        });
      })
    ));
  }

  function buildDesignCells(design) {
    const map = getPaletteMap("mard");
    const cells = [];
    for (let y = 0; y < design.gridHeight; y += 1) {
      for (let x = 0; x < design.gridWidth; x += 1) {
        const shortId = designTokenAt(design, x, y);
        const color = shortId ? map[shortId] : null;
        if (!color) {
          cells.push({ x, y, colorId: "", hex: "transparent", rgb: [255, 255, 255], isTransparent: true });
        } else {
          cells.push({ x, y, colorId: color.id, shortId: color.shortId, hex: color.hex, rgb: color.rgb, isTransparent: false });
        }
      }
    }
    return cells;
  }

  function designTokenAt(design, x, y) {
    const w = design.gridWidth;
    const h = design.gridHeight;
    const c = design.colors;
    const nx = ((x + 0.5) / w) * 2 - 1;
    const ny = ((y + 0.5) / h) * 2 - 1;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const ellipse = (cx, cy, rx, ry) => (((nx - cx) / rx) ** 2) + (((ny - cy) / ry) ** 2) <= 1;
    const rect = (x1, y1, x2, y2) => nx >= x1 && nx <= x2 && ny >= y1 && ny <= y2;
    const tri = (cx, top, half, bottom) => ny >= top && ny <= bottom && Math.abs(nx - cx) <= half * ((ny - top) / Math.max(bottom - top, 0.01));

    if (design.shape === "heart") {
      const v = ((nx * 1.15) ** 2 + (ny * 1.25 + 0.28) ** 2 - 0.55) ** 3 - (nx * 1.15) ** 2 * (ny * 1.25 + 0.28) ** 3;
      if (v <= 0) return ay > 0.72 || ax > 0.78 ? c.dark : (ny < -0.1 ? c.main : c.accent);
    }
    if (design.shape === "bow") {
      if (ellipse(-0.45, 0, 0.42, 0.46) || ellipse(0.45, 0, 0.42, 0.46)) return ax > 0.72 ? c.dark : c.main;
      if (ellipse(0, 0, 0.22, 0.32)) return c.accent;
    }
    if (design.shape === "flower") {
      if (ellipse(0, 0, 0.24, 0.24)) return c.accent;
      if (ellipse(0, -0.45, 0.3, 0.28) || ellipse(0, 0.45, 0.3, 0.28) || ellipse(-0.45, 0, 0.28, 0.3) || ellipse(0.45, 0, 0.28, 0.3)) return c.main;
      if (rect(-0.08, 0.45, 0.08, 0.92)) return c.green;
    }
    if (design.shape === "tulip") {
      if (ellipse(-0.2, -0.45, 0.26, 0.34) || ellipse(0.2, -0.45, 0.26, 0.34) || ellipse(0, -0.2, 0.42, 0.38)) return c.main;
      if (rect(-0.08, 0.05, 0.08, 0.88)) return c.green;
      if (ellipse(-0.32, 0.42, 0.24, 0.16) || ellipse(0.32, 0.55, 0.24, 0.16)) return c.green;
    }
    if (design.shape === "star") {
      const angle = Math.atan2(ny, nx);
      const radius = Math.sqrt(nx * nx + ny * ny);
      const spikes = 0.45 + 0.22 * Math.cos(5 * angle);
      if (radius < spikes) return radius > spikes - 0.12 ? c.dark : c.accent;
    }
    if (design.shape === "moon") {
      if (ellipse(-0.05, 0, 0.58, 0.72) && !ellipse(0.28, -0.08, 0.52, 0.66)) return c.accent;
    }
    if (design.shape === "cloud") {
      if (ellipse(-0.45, 0.12, 0.34, 0.34) || ellipse(-0.12, -0.08, 0.42, 0.42) || ellipse(0.28, 0.02, 0.38, 0.38) || rect(-0.7, 0.02, 0.66, 0.48)) return c.light;
    }
    if (design.shape === "rainbow") {
      const dx = nx;
      const dy = ny - 0.56;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (dy < 0 && r < 1.02 && r > 0.46) {
        if (r > 0.86) return c.main;
        if (r > 0.72) return c.accent;
        if (r > 0.58) return c.green;
        return c.deep;
      }
    }
    if (design.shape === "apple") {
      if (ellipse(-0.22, 0.04, 0.38, 0.5) || ellipse(0.22, 0.04, 0.38, 0.5)) return ny > 0.5 || ax > 0.58 ? c.dark : c.main;
      if (rect(-0.06, -0.78, 0.08, -0.48)) return "G13";
      if (ellipse(0.25, -0.62, 0.26, 0.12)) return c.green;
    }
    if (design.shape === "cherry") {
      if (ellipse(-0.3, 0.2, 0.28, 0.3) || ellipse(0.34, 0.24, 0.28, 0.3)) return c.main;
      if ((x === Math.round(w * 0.48) && y > h * 0.18 && y < h * 0.52) || rect(-0.08, -0.58, 0.06, -0.06)) return c.green;
    }
    if (design.shape === "mushroom") {
      if (ny < -0.05 && ellipse(0, -0.1, 0.72, 0.5)) return c.main;
      if (rect(-0.28, -0.04, 0.28, 0.72)) return c.accent;
      if ((ellipse(-0.28, -0.2, 0.12, 0.12) || ellipse(0.26, -0.28, 0.1, 0.1)) && ny < 0) return c.light;
    }
    if (design.shape === "cat") {
      if (tri(-0.42, -0.82, 0.24, -0.24) || tri(0.42, -0.82, 0.24, -0.24) || ellipse(0, 0.05, 0.68, 0.6)) {
        if ((ellipse(-0.24, 0.02, 0.08, 0.08) || ellipse(0.24, 0.02, 0.08, 0.08))) return c.dark;
        return c.main;
      }
    }
    if (design.shape === "bunny") {
      if (ellipse(-0.28, -0.44, 0.18, 0.5) || ellipse(0.28, -0.44, 0.18, 0.5) || ellipse(0, 0.25, 0.58, 0.52)) {
        if (ellipse(-0.18, 0.22, 0.08, 0.08) || ellipse(0.18, 0.22, 0.08, 0.08)) return c.dark;
        return c.light;
      }
    }
    if (design.shape === "bear") {
      if (ellipse(-0.5, -0.38, 0.24, 0.24) || ellipse(0.5, -0.38, 0.24, 0.24) || ellipse(0, 0.04, 0.64, 0.58)) {
        if (ellipse(0, 0.22, 0.18, 0.13)) return c.accent;
        return "G9";
      }
    }
    if (design.shape === "fish") {
      if (ellipse(-0.08, 0, 0.58, 0.42) || tri(0.72, -0.44, 0.36, 0.44)) {
        if (ellipse(-0.38, -0.08, 0.07, 0.07)) return c.dark;
        return c.deep;
      }
    }
    return "";
  }

  function buildGuideSections(project, options) {
    const preferred = options && Number(options.blockSize);
    const blockSize = preferred || resolveGuideBlockSize(project);
    const sections = [];

    for (let y = 0; y < project.gridHeight; y += blockSize) {
      for (let x = 0; x < project.gridWidth; x += blockSize) {
        const width = Math.min(blockSize, project.gridWidth - x);
        const height = Math.min(blockSize, project.gridHeight - y);
        const cells = [];
        for (let row = y; row < y + height; row += 1) {
          for (let col = x; col < x + width; col += 1) {
            const cell = project.cells[row * project.gridWidth + col];
            if (cell && !cell.isTransparent) cells.push(cell);
          }
        }

        if (!cells.length) continue;
        const colorStats = summarizeCells(cells);
        const totalBeads = colorStats.reduce((sum, stat) => sum + stat.count, 0);
        const order = sections.length + 1;
        sections.push({
          id: `section-${x}-${y}-${width}-${height}`,
          label: `第 ${order} 块`,
          x,
          y,
          width,
          height,
          totalBeads,
          density: Math.round((totalBeads / (width * height)) * 100),
          boundsLabel: `X${x + 1}-${x + width} / Y${y + 1}-${y + height}`,
          colorStats,
          colorPlan: buildSectionColorPlan(colorStats)
        });
      }
    }

    return sections;
  }

  function resolveGuideBlockSize(project) {
    const longest = Math.max(project.gridWidth, project.gridHeight);
    if (longest <= 24) return 6;
    if (longest <= 42) return 8;
    if (longest <= 72) return 10;
    if (longest <= 96) return 12;
    return 15;
  }

  function buildSectionColorPlan(colorStats) {
    const byCount = colorStats.slice().sort((a, b) => b.count - a.count || a.colorId.localeCompare(b.colorId));
    const outline = colorStats
      .filter((stat) => stat.count >= 2)
      .slice()
      .sort((a, b) => luminance(a.rgb) - luminance(b.rgb))[0];

    if (!outline) return byCount;
    return [outline].concat(byCount.filter((stat) => stat.colorId !== outline.colorId));
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function textColorFor(rgb) {
    return ((rgb[0] * 0.299) + (rgb[1] * 0.587) + (rgb[2] * 0.114)) > 156 ? "#1f1f1c" : "#ffffff";
  }

  function drawPatternCanvas(canvas, project, options) {
    const ctx = canvas.getContext("2d");
    const selectedColorId = options && options.selectedColorId;
    const focusedSection = options && options.focusedSection;
    const guideSections = options && options.guideSections ? options.guideSections : [];
    const completedSectionIds = new Set(options && options.completedSectionIds ? options.completedSectionIds : []);
    const pixelRatio = options && options.pixelRatio ? options.pixelRatio : 1;
    const cssWidth = options && options.width ? options.width : canvas.clientWidth || 900;
    const axis = Number.isFinite(Number(options && options.axis)) ? Number(options.axis) : 34;
    const padding = Number.isFinite(Number(options && options.padding)) ? Number(options.padding) : 18;
    const minCellSize = Number.isFinite(Number(options && options.minCellSize)) ? Number(options.minCellSize) : 14;
    const cellSize = Math.max(minCellSize, Math.floor((cssWidth - padding * 2 - axis * 2) / Math.max(project.gridWidth, project.gridHeight)));
    const width = padding * 2 + axis * 2 + (project.gridWidth * cellSize);
    const height = padding * 2 + axis * 2 + (project.gridHeight * cellSize);
    const labelFontSize = axis <= 24 ? 8 : 10;
    const labelStep = cellSize < 7 ? 10 : cellSize < 10 ? 5 : cellSize < 12 ? 2 : 1;
    setupCanvas(canvas, ctx, width, height, pixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gridX = padding + axis;
    const gridY = padding + axis;

    for (let x = 0; x < project.gridWidth; x += 1) {
      if (labelStep > 1 && x !== 0 && x !== project.gridWidth - 1 && (x + 1) % labelStep !== 0) continue;
      const labelX = gridX + x * cellSize + cellSize / 2;
      ctx.fillStyle = "#9b9b94";
      ctx.font = `${labelFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(String(x + 1), labelX, padding + 9);
      ctx.fillText(String(x + 1), labelX, gridY + project.gridHeight * cellSize + Math.max(12, axis - 16));
    }

    for (let y = 0; y < project.gridHeight; y += 1) {
      if (labelStep > 1 && y !== 0 && y !== project.gridHeight - 1 && (y + 1) % labelStep !== 0) continue;
      const labelY = gridY + y * cellSize + cellSize / 2;
      ctx.fillStyle = "#9b9b94";
      ctx.font = `${labelFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(String(y + 1), padding + 11, labelY);
      ctx.fillText(String(y + 1), gridX + project.gridWidth * cellSize + Math.max(12, axis - 16), labelY);
    }

    project.cells.forEach((cell) => {
      const x = gridX + cell.x * cellSize;
      const y = gridY + cell.y * cellSize;
      const dimByColor = selectedColorId && cell.colorId !== selectedColorId;
      const dimBySection = focusedSection && !cellInSection(cell, focusedSection);
      const dim = dimByColor || dimBySection;
      if (!cell.isTransparent) {
        ctx.fillStyle = dim ? fadeRgb(cell.rgb, 0.78) : cell.hex;
        ctx.fillRect(x, y, cellSize, cellSize);
        if (cellSize >= 12) {
          const label = cell.shortId || cell.colorId;
          ctx.fillStyle = dim ? "#898982" : textColorFor(cell.rgb);
          ctx.font = `${fitCellLabelFont(ctx, label, cellSize)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText(label, x + cellSize / 2, y + cellSize / 2 + 0.5);
        }
      }
    });

    drawGrid(ctx, gridX, gridY, project.gridWidth, project.gridHeight, cellSize, 0, 0, cellSize >= 7);
    guideSections.forEach((section) => {
      if (completedSectionIds.has(section.id)) {
        drawCompletedSection(ctx, section, gridX, gridY, cellSize);
      }
    });
    if (focusedSection) {
      drawFocusedSection(ctx, focusedSection, gridX, gridY, cellSize);
    }
    return { width, height, cellSize, gridX, gridY };
  }

  function cellInSection(cell, section) {
    return cell.x >= section.x &&
      cell.y >= section.y &&
      cell.x < section.x + section.width &&
      cell.y < section.y + section.height;
  }

  function fitCellLabelFont(ctx, label, cellSize) {
    const text = String(label || "");
    let fontSize = cellSize >= 20 ? 10 : cellSize >= 16 ? 8 : 7;
    const minFontSize = 5;
    const maxWidth = Math.max(4, cellSize - 1.5);
    while (fontSize > minFontSize) {
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      fontSize -= 1;
    }
    return fontSize;
  }

  function drawFocusedSection(ctx, section, gridX, gridY, cellSize) {
    const x = gridX + section.x * cellSize;
    const y = gridY + section.y * cellSize;
    const width = section.width * cellSize;
    const height = section.height * cellSize;
    ctx.save();
    ctx.strokeStyle = "#151512";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
    ctx.fillStyle = "rgba(23, 23, 20, 0.08)";
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  function drawCompletedSection(ctx, section, gridX, gridY, cellSize) {
    const x = gridX + section.x * cellSize;
    const y = gridY + section.y * cellSize;
    const width = section.width * cellSize;
    const height = section.height * cellSize;
    ctx.save();
    ctx.fillStyle = "rgba(127, 182, 160, 0.2)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "rgba(47, 107, 88, 0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    if (width >= 44 && height >= 34) {
      ctx.strokeStyle = "rgba(47, 107, 88, 0.92)";
      ctx.lineWidth = Math.max(2, cellSize * 0.16);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x + width * 0.34, y + height * 0.54);
      ctx.lineTo(x + width * 0.46, y + height * 0.66);
      ctx.lineTo(x + width * 0.68, y + height * 0.36);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPreviewCanvas(canvas, project, options) {
    const ctx = canvas.getContext("2d");
    const mode = options && options.mode ? options.mode : "beads";
    const pixelRatio = options && options.pixelRatio ? options.pixelRatio : 1;
    const cssWidth = options && options.width ? options.width : canvas.clientWidth || 900;
    const padding = Number.isFinite(Number(options && options.padding)) ? Number(options.padding) : 28;
    const cellSize = Math.max(5, Math.floor((cssWidth - padding * 2) / Math.max(project.gridWidth, project.gridHeight)));
    const width = padding * 2 + project.gridWidth * cellSize;
    const height = padding * 2 + project.gridHeight * cellSize;
    setupCanvas(canvas, ctx, width, height, pixelRatio);
    ctx.fillStyle = mode === "back" ? "#f0efea" : mode === "glitter" ? "#fbfaf6" : "#ffffff";
    ctx.fillRect(0, 0, width, height);
    project.cells.forEach((cell) => {
      if (cell.isTransparent) return;
      const sourceX = mode === "back" ? project.gridWidth - 1 - cell.x : cell.x;
      const x = padding + sourceX * cellSize;
      const y = padding + cell.y * cellSize;
      drawPreviewCell(ctx, cell, x, y, cellSize, mode);
    });
    return { width, height, cellSize };
  }

  function drawPreviewCell(ctx, cell, x, y, cellSize, mode) {
    if (mode === "normal") {
      ctx.fillStyle = fadeRgb(cell.rgb, 0.08);
      roundedRect(ctx, x + 0.6, y + 0.6, cellSize - 0.2, cellSize - 0.2, Math.max(1, cellSize * 0.22));
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + cellSize * 0.14, y + cellSize * 0.12, cellSize * 0.62, Math.max(1, cellSize * 0.08));
      return;
    }

    if (mode === "towel") {
      ctx.fillStyle = fadeRgb(cell.rgb, 0.16);
      ctx.fillRect(x + 0.5, y + 0.5, cellSize, cellSize);
      drawTowelTexture(ctx, cell, x, y, cellSize);
      return;
    }

    if (mode === "bath") {
      ctx.fillStyle = fadeRgb(cell.rgb, 0.12);
      ctx.fillRect(x + 0.4, y + 0.4, cellSize + 0.2, cellSize + 0.2);
      drawBathTexture(ctx, cell, x, y, cellSize);
      return;
    }

    if (mode === "glitter") {
      ctx.fillStyle = fadeRgb(cell.rgb, 0.05);
      roundedRect(ctx, x + 0.4, y + 0.4, cellSize + 0.2, cellSize + 0.2, Math.max(1, cellSize * 0.16));
      ctx.fill();
      drawGlitter(ctx, cell, x, y, cellSize);
      return;
    }

    if (mode === "back") {
      ctx.fillStyle = fadeRgb(cell.rgb, 0.22);
      ctx.fillRect(x + 1, y + 1, Math.max(1, cellSize - 1), Math.max(1, cellSize - 1));
      return;
    }

    ctx.fillStyle = cell.hex;
    ctx.beginPath();
    ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(1.6, cellSize * 0.43), 0, Math.PI * 2);
    ctx.fill();
    if (cellSize >= 8) {
      ctx.fillStyle = "rgba(255,255,255,0.48)";
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(0.8, cellSize * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTowelTexture(ctx, cell, x, y, cellSize) {
    const seed = cell.x * 928371 + cell.y * 192811 + 17;
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = Math.max(0.8, cellSize * 0.08);
    for (let i = 0; i < 3; i += 1) {
      const offset = pseudo(seed + i) * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, y + offset);
      ctx.quadraticCurveTo(x + cellSize * 0.35, y + offset - cellSize * 0.16, x + cellSize, y + offset + cellSize * 0.08);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(x + cellSize * 0.12, y + cellSize * 0.72, cellSize * 0.72, Math.max(1, cellSize * 0.08));
  }

  function drawBathTexture(ctx, cell, x, y, cellSize) {
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = Math.max(0.8, cellSize * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y + cellSize * 0.25);
    ctx.lineTo(x + cellSize * 0.75, y + cellSize);
    ctx.moveTo(x + cellSize * 0.25, y);
    ctx.lineTo(x + cellSize, y + cellSize * 0.75);
    ctx.moveTo(x + cellSize, y + cellSize * 0.25);
    ctx.lineTo(x + cellSize * 0.25, y + cellSize);
    ctx.moveTo(x + cellSize * 0.75, y);
    ctx.lineTo(x, y + cellSize * 0.75);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(0.8, cellSize * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGlitter(ctx, cell, x, y, cellSize) {
    const seed = cell.x * 431 + cell.y * 997 + 41;
    for (let i = 0; i < 3; i += 1) {
      const px = x + pseudo(seed + i * 11) * cellSize;
      const py = y + pseudo(seed + i * 17) * cellSize;
      const size = Math.max(1.2, cellSize * (0.12 + pseudo(seed + i * 23) * 0.08));
      ctx.strokeStyle = i === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,226,128,0.82)";
      ctx.lineWidth = Math.max(0.6, cellSize * 0.04);
      ctx.beginPath();
      ctx.moveTo(px - size, py);
      ctx.lineTo(px + size, py);
      ctx.moveTo(px, py - size);
      ctx.lineTo(px, py + size);
      ctx.stroke();
    }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function pseudo(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawExportCanvas(canvas, project, options) {
    const ctx = canvas.getContext("2d");
    const range = options && options.range;
    const startX = range ? range.x : 0;
    const startY = range ? range.y : 0;
    const cellsWide = range ? range.width : project.gridWidth;
    const cellsHigh = range ? range.height : project.gridHeight;
    const stats = range && range.colorStats ? range.colorStats : project.colorStats;
    const totalBeads = range && Number.isFinite(range.totalBeads) ? range.totalBeads : project.totalBeads;
    const cellSize = Math.max(14, Math.min(28, Math.floor(1180 / Math.max(cellsWide, cellsHigh))));
    const margin = 54;
    const axis = 36;
    const summaryRows = Math.max(1, Math.ceil(stats.length / 8));
    const width = margin * 2 + axis * 2 + cellsWide * cellSize;
    const height = margin * 2 + 96 + axis * 2 + cellsHigh * cellSize + Math.max(118, summaryRows * 76);
    setupCanvas(canvas, ctx, width, height, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#171716";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(project.title || "拼豆图纸", margin, margin + 24);
    ctx.fillStyle = "#5f5e58";
    ctx.font = "22px -apple-system, BlinkMacSystemFont, sans-serif";
    const pageText = range && range.total > 1 ? ` · Page ${range.index}/${range.total}` : "";
    const rangeText = range ? ` · ${cellsWide}x${cellsHigh} · ${totalBeads} 颗` : ` · ${project.gridWidth}x${project.gridHeight} · ${project.totalBeads} 颗`;
    ctx.fillText(`${project.palettePresetId}${rangeText}${pageText}`, margin, margin + 62);

    const gridX = margin + axis;
    const gridY = margin + 96 + axis;
    ctx.textAlign = "center";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    for (let x = 0; x < cellsWide; x += 1) {
      const n = startX + x + 1;
      const labelX = gridX + x * cellSize + cellSize / 2;
      ctx.fillStyle = "#999991";
      ctx.fillText(String(n), labelX, gridY - 15);
      ctx.fillText(String(n), labelX, gridY + cellsHigh * cellSize + 24);
    }
    for (let y = 0; y < cellsHigh; y += 1) {
      const n = startY + y + 1;
      const labelY = gridY + y * cellSize + cellSize / 2;
      ctx.fillStyle = "#999991";
      ctx.fillText(String(n), gridX - 20, labelY);
      ctx.fillText(String(n), gridX + cellsWide * cellSize + 20, labelY);
    }

    for (let y = 0; y < cellsHigh; y += 1) {
      for (let x = 0; x < cellsWide; x += 1) {
        const cell = project.cells[(startY + y) * project.gridWidth + startX + x];
        const drawX = gridX + x * cellSize;
        const drawY = gridY + y * cellSize;
        if (cell && !cell.isTransparent) {
          ctx.fillStyle = cell.hex;
          ctx.fillRect(drawX, drawY, cellSize, cellSize);
          if (cellSize >= 17) {
            ctx.fillStyle = textColorFor(cell.rgb);
            ctx.font = `${cellSize >= 22 ? 13 : 10}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(cell.colorId, drawX + cellSize / 2, drawY + cellSize / 2);
          }
        }
      }
    }
    drawGrid(ctx, gridX, gridY, cellsWide, cellsHigh, cellSize, startX, startY);
    drawSummary(ctx, stats, margin, gridY + cellsHigh * cellSize + 62, width - margin * 2);
    return { width, height };
  }

  function setupCanvas(canvas, ctx, width, height, pixelRatio) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawGrid(ctx, gridX, gridY, gridWidth, gridHeight, cellSize, offsetX, offsetY, showFineLines = true) {
    for (let x = 0; x <= gridWidth; x += 1) {
      if (!showFineLines && x !== 0 && x !== gridWidth && (offsetX + x) % 5 !== 0) continue;
      ctx.strokeStyle = (offsetX + x) % 5 === 0 ? "#b8b8ca" : "#deded9";
      ctx.lineWidth = (offsetX + x) % 5 === 0 ? 1.2 : 0.6;
      ctx.beginPath();
      ctx.moveTo(gridX + x * cellSize, gridY);
      ctx.lineTo(gridX + x * cellSize, gridY + gridHeight * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y += 1) {
      if (!showFineLines && y !== 0 && y !== gridHeight && (offsetY + y) % 5 !== 0) continue;
      ctx.strokeStyle = (offsetY + y) % 5 === 0 ? "#b8b8ca" : "#deded9";
      ctx.lineWidth = (offsetY + y) % 5 === 0 ? 1.2 : 0.6;
      ctx.beginPath();
      ctx.moveTo(gridX, gridY + y * cellSize);
      ctx.lineTo(gridX + gridWidth * cellSize, gridY + y * cellSize);
      ctx.stroke();
    }
  }

  function drawSummary(ctx, colorStats, left, top, width) {
    const itemWidth = Math.floor(width / 8);
    const chipSize = 42;
    colorStats.forEach((stat, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const x = left + col * itemWidth;
      const y = top + row * 76;
      ctx.fillStyle = stat.hex;
      ctx.fillRect(x, y, chipSize, chipSize);
      ctx.fillStyle = textColorFor(stat.rgb);
      ctx.font = "700 14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(stat.colorId, x + chipSize / 2, y + chipSize / 2 + 1);
      ctx.fillStyle = "#22221f";
      ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`x${stat.count}`, x, y + 62);
    });
  }

  function drawColorStatsCanvas(canvas, project) {
    const ctx = canvas.getContext("2d");
    const margin = 54;
    const width = 1200;
    const columns = 4;
    const gap = 18;
    const itemWidth = Math.floor((width - margin * 2 - gap * (columns - 1)) / columns);
    const itemHeight = 78;
    const rows = Math.max(1, Math.ceil(project.colorStats.length / columns));
    const height = margin * 2 + 112 + rows * itemHeight;
    setupCanvas(canvas, ctx, width, height, 1);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#171716";
    ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${project.title || "拼豆图纸"} · 色库清单`, margin, margin + 24);

    ctx.fillStyle = "#5f5e58";
    ctx.font = "22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${project.palettePresetId} · ${project.gridWidth}x${project.gridHeight} · ${project.totalBeads} 颗 · ${project.colorStats.length} 个色号`, margin, margin + 62);

    const startY = margin + 112;
    project.colorStats.forEach((stat, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + col * (itemWidth + gap);
      const y = startY + row * itemHeight;

      ctx.fillStyle = "#f7f7f4";
      roundedRect(ctx, x, y, itemWidth, 58, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(28, 28, 25, 0.09)";
      ctx.stroke();

      ctx.fillStyle = stat.hex;
      ctx.fillRect(x + 10, y + 10, 38, 38);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(x + 10, y + 10, 38, 38);

      ctx.fillStyle = textColorFor(stat.rgb);
      ctx.font = "700 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(stat.colorId, x + 29, y + 30);

      ctx.textAlign = "left";
      ctx.fillStyle = "#171716";
      ctx.font = "700 20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(stat.colorId, x + 62, y + 23);
      ctx.fillStyle = "#5f5e58";
      ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(`x${stat.count}`, x + 62, y + 45);
    });

    return { width, height };
  }

  function fadeRgb(rgb, amount) {
    return rgbToHex(mixRgb(rgb, [255, 255, 255], amount));
  }

  function summarizeRange(project, range) {
    const cells = [];
    const startX = range.x;
    const startY = range.y;
    const endX = startX + range.width;
    const endY = startY + range.height;
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const cell = project.cells[y * project.gridWidth + x];
        if (cell && !cell.isTransparent) cells.push(cell);
      }
    }
    const colorStats = summarizeCells(cells);
    return {
      colorStats,
      totalBeads: colorStats.reduce((sum, stat) => sum + stat.count, 0)
    };
  }

  function getExportPages(project, chunkSize) {
    const chunk = chunkSize || 50;
    const pages = [];
    for (let y = 0; y < project.gridHeight; y += chunk) {
      for (let x = 0; x < project.gridWidth; x += chunk) {
        const page = {
          x,
          y,
          width: Math.min(chunk, project.gridWidth - x),
          height: Math.min(chunk, project.gridHeight - y)
        };
        const stats = summarizeRange(project, page);
        if (stats.totalBeads > 0) {
          pages.push({
            ...page,
            ...stats,
            index: pages.length + 1
          });
        }
      }
    }
    return pages.map((page) => ({ ...page, total: pages.length }));
  }

  return {
    LOCAL_LIBRARY_PATTERNS,
    PALETTES,
    PRESETS,
    getPalette,
    getPreset,
    getPaletteMap,
    getColorsForPreset,
    estimateGridSize,
    estimateImageDetail,
    estimateSubjectCrop,
    enhanceImageData,
    buildPatternFromImageData,
    recognizePatternChart,
    estimateChartGrid,
    buildGuideSections,
    summarizeCells,
    normalizeLibraryPattern,
    projectToLibraryPattern,
    createProjectFromLibraryPattern,
    finalizeProject,
    drawPatternCanvas,
    drawPreviewCanvas,
    drawExportCanvas,
    drawColorStatsCanvas,
    getExportPages,
    rgbToHex,
    hexToRgb,
    rgbToLab,
    deltaE
  };
}));
