/**
 * 三端设计 token 一致性门禁。
 *
 * 为什么需要它：Web / Flutter / Desktop 是三个独立仓库，无法共享运行时；
 * 一旦品牌色、中性阶梯或圆角语义在某一端被手改，页面会在跨端切换时出现
 * “同名不同值”。本脚本以 docs/design-tokens.json 为契约，校验平台事实源，
 * 并额外检查 Web/Desktop 的 var(--token) 是否存在定义。
 *
 * 运行：
 *   node scripts/check-design-tokens.mjs                    # 单仓三端全量
 *   node scripts/check-design-tokens.mjs --platform=web     # 只校验 Web
 *   node scripts/check-design-tokens.mjs --platform=desktop --root=../x-pan-desktop
 *   node scripts/check-design-tokens.mjs --platform=flutter --contract=/tmp/design-tokens.json --root=../x-pan-mobile
 *
 * 边界：这是契约校验，不自动改写三端文件。`--root` 指向某一个子仓库时，
 * 允许把契约里的 `x-pan-frontend/...` 前缀剥掉，匹配该仓库内的相对路径；
 * 这样 CI 可以直接复用同一份脚本与契约，不必在三个仓库各维护一份副本。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const root = path.resolve(argValue("root") || scriptRoot);
const contractPath = path.resolve(
  argValue("contract") || path.join(root, "docs/design-tokens.json")
);
const requested = (argValue("platform") || "all").toLowerCase();
const platformAliases = { flutter: "flutter", web: "web", desktop: "desktop" };
const allPlatforms = ["web", "desktop", "flutter"];
const platforms = requested === "all"
  ? allPlatforms
  : [platformAliases[requested]].filter(Boolean);

if (platforms.length === 0) {
  console.error(`Unknown --platform=${requested}; use web, desktop, flutter or all.`);
  process.exit(2);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

// 同一份契约既能在 monorepo 根使用，也能在单个子仓库中使用：
// 先试契约里的完整路径，再剥掉 `x-pan-*` 顶层目录，最后按平台给一个固定 fallback。
const platformFallbacks = {
  web: "src/styles/tokens.css",
  desktop: "src/style.css",
  flutter: "lib/core/theme/app_tokens.dart",
};

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveContractPath(rel) {
  const direct = path.join(root, rel);
  const entries = rel.split("/");
  const stripped = entries.length > 1 && /^x-pan-/.test(entries[0])
    ? path.join(root, entries.slice(1).join("/"))
    : null;
  return firstExisting([direct, stripped].filter(Boolean));
}

function resolveSource(platform) {
  const resolved = resolveContractPath(contract.files[platform]);
  if (resolved) return resolved;
  return firstExisting([path.join(root, platformFallbacks[platform])]);
}

const sourcePaths = {};
for (const platform of platforms) {
  const resolved = resolveSource(platform);
  if (!resolved) {
    console.error(`Missing token source for ${platform}: ${contract.files[platform]}`);
    process.exit(1);
  }
  sourcePaths[platform] = resolved;
}
const sources = Object.fromEntries(
  Object.entries(sourcePaths).map(([platform, sourcePath]) => [
    platform,
    fs.readFileSync(sourcePath, "utf8"),
  ])
);

// 契约本身会在注释里解释色值（例如“白字按钮使用 #245BFF”）。如果直接对全文
// 做包含判断，注释就能替声明“过关”，真实 token 被改掉也检测不到。因此所有
// 色值/圆角检查都只看去掉注释后的代码；这也是这套门禁能阻断漂移的前提。
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/.*$/gm, "");
}

const codeSources = Object.fromEntries(
  Object.entries(sources).map(([platform, source]) => [platform, stripComments(source)])
);

const failures = [];
const checks = [];

function pass(message) {
  checks.push(`  ✓ ${message}`);
}

function fail(message) {
  checks.push(`  ✗ ${message}`);
  failures.push(message);
}

function lower(value) {
  return value.toLowerCase();
}

function hasHex(source, hex) {
  return lower(source).includes(lower(hex));
}

function hasFlutterColor(source, hex) {
  return lower(source).includes(`0xff${lower(hex.replace(/^#/, ""))}`);
}

function expectHex(platform, hex, label) {
  const ok =
    platform === "flutter"
      ? hasFlutterColor(codeSources.flutter, hex)
      : hasHex(codeSources[platform], hex);
  if (ok) {
    pass(`${platform} ${label} = ${hex}`);
  } else {
    fail(`${platform} 缺少 ${label} (${hex})`);
  }
}

// 1a. 语义绑定：只验证“某个色值在文件里出现”是不够的——同一个色值可能
// 被 primary-600 等别名重复声明，action 漂移后仍能蒙混过关。这里按变量名
// 逐个核对亮/暗块，确保契约里的 token 真的绑定到了它该在的变量上。
//
// 只对 Web/Desktop 做：Flutter 的常量名是 AppTokens.xxx，另行由 radius /
// 颜色出现性检查覆盖；后续如果 Flutter 需要强绑定，再在契约里补变量名。
function collectCssDeclarations(source) {
  const result = { light: new Map(), dark: new Map() };
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // 上一个规则的结尾（`;` 或 `}`）之后才是真正的选择器；否则
    // `@custom-variant ...; @theme {` 会被当成同一个选择器，把亮色 token
    // 误判进 .dark 块。
    let selector = match[1].trim();
    const boundary = Math.max(selector.lastIndexOf("}"), selector.lastIndexOf(";"));
    if (boundary >= 0) selector = selector.slice(boundary + 1).trim();
    const body = match[2];
    const mode = /(^|[\s,>+~])\.dark(?:[\s,>+~.]|$)/.test(selector) ? "dark" : "light";
    for (const declaration of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      result[mode].set(declaration[1], declaration[2].trim());
    }
  }
  return result;
}

const colorBindings = {
  brand: {
    primary: "--color-brand",
    action: "--color-brand-action",
    actionHover: "--color-brand-action-hover",
    actionActive: "--color-brand-action-active",
    soft: "--color-brand-soft",
    sky: "--color-brand-sky",
  },
  semantic: {
    success: "--color-success",
    warning: "--color-warning",
    danger: "--color-danger",
    successText: "--color-success-text",
    warningText: "--color-warning-text",
    dangerText: "--color-danger-text",
  },
  light: {
    bg: "--color-bg",
    surface: "--color-surface",
    surface2: "--color-surface-2",
    surface3: "--color-surface-3",
    border: "--color-border",
    borderStrong: "--color-border-strong",
    text: "--color-text",
    textSecondary: "--color-text-secondary",
    textMuted: "--color-text-muted",
    textDisabled: "--color-text-disabled",
  },
  dark: {
    bg: "--color-bg",
    surface: "--color-surface",
    surface2: "--color-surface-2",
    surface3: "--color-surface-3",
    border: "--color-border",
    borderStrong: "--color-border-strong",
    text: "--color-text",
    textSecondary: "--color-text-secondary",
    textMuted: "--color-text-muted",
    textDisabled: "--color-text-disabled",
  },
};

const declarationsByPlatform = Object.fromEntries(
  Object.entries(sources).map(([platform, source]) => [
    platform,
    collectCssDeclarations(stripComments(source)),
  ])
);

function normalizeColor(value) {
  return String(value || "").trim().toLowerCase();
}

for (const [group, entries] of Object.entries(colorBindings)) {
  const mode = group === "dark" ? "dark" : "light";
  for (const platform of platforms) {
    if (platform === "flutter") continue;
    for (const [key, variable] of Object.entries(entries)) {
      const expected = contract.colors[group]?.[key];
      if (!expected) continue;
      const actual = declarationsByPlatform[platform][mode].get(variable.replace(/^--/, ""));
      if (normalizeColor(actual) === normalizeColor(expected)) {
        pass(`${platform} ${group}.${key} 绑定 ${variable} = ${expected}`);
      } else {
        fail(`${platform} ${group}.${key} 期望 ${variable}: ${expected}，实际 ${actual ?? "缺失"}`);
      }
    }
  }
}

// 1. 品牌 / 中性 / 语义色：请求的平台必须全部存在
const colorGroups = [
  ["brand", contract.colors.brand],
  ["semantic", contract.colors.semantic],
  ["light", contract.colors.light],
  ["dark", contract.colors.dark],
];

for (const [group, entries] of colorGroups) {
  for (const [name, hex] of Object.entries(entries)) {
    for (const platform of platforms) {
      expectHex(platform, hex, `${group}.${name}`);
    }
  }
}

// 2. 圆角：平台差异是契约的一部分，不是越界
function readCssRadii(source) {
  const result = new Map();
  for (const match of source.matchAll(/--radius-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    result.set(match[1], match[2].trim());
  }
  return result;
}

function readFlutterRadii(source) {
  const result = new Map();
  for (const match of source.matchAll(/radius([A-Za-z]+)\s*=\s*([0-9.]+);/g)) {
    result.set(match[1].toLowerCase(), Number(match[2]));
  }
  return result;
}

const radiiByPlatform = {
  web: readCssRadii(codeSources.web || ""),
  desktop: readCssRadii(codeSources.desktop || ""),
  flutter: readFlutterRadii(codeSources.flutter || ""),
};

for (const platform of platforms) {
  const expectedGroup = contract.radius[platform];
  if (!expectedGroup) {
    fail(`契约缺少 ${platform} 圆角定义`);
    continue;
  }
  for (const [key, expected] of Object.entries(expectedGroup)) {
    if (radiiByPlatform[platform].get(key) === expected) {
      pass(`${platform} radius.${key} = ${expected}`);
    } else {
      fail(`${platform} radius.${key} 期望 ${expected}，实际 ${radiiByPlatform[platform].get(key) ?? "缺失"}`);
    }
  }
}

// 3. CSS 变量引用必须都有定义（Web/Desktop）
function resolveRepoDir(rel) {
  const direct = path.join(root, rel);
  if (fs.existsSync(direct)) return direct;
  const entries = rel.split("/");
  if (entries.length > 1 && /^x-pan-/.test(entries[0])) {
    const stripped = path.join(root, entries.slice(1).join("/"));
    if (fs.existsSync(stripped)) return stripped;
  }
  return null;
}

function walkFiles(dir, suffixes) {
  if (!dir || !fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(full, suffixes));
    else if (suffixes.includes(path.extname(entry.name))) output.push(full);
  }
  return output;
}

function collectCssVarProblems(platform, source, files) {
  const defined = new Set(
    [...source.matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1])
  );
  const refs = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/var\(--([a-z0-9-]+)/g)) {
      refs.add(match[1]);
    }
  }
  const missing = [...refs].filter((name) => !defined.has(name)).sort();
  if (missing.length === 0) {
    pass(`${platform} var(--token) 引用全部有定义（${refs.size} 个引用）`);
  } else {
    fail(`${platform} 存在未定义 token：${missing.join(", ")}`);
  }
}

if (platforms.includes("web")) {
  const webDir = resolveRepoDir("x-pan-fronted/src");
  const webVueFiles = walkFiles(webDir, [".vue"]);
  collectCssVarProblems("web", sources.web, walkFiles(webDir, [".vue", ".css", ".scss", ".ts"]));

  // Web 组件里的“浅色调色板类”不会自动随暗色主题反转：
  // 例如 bg-primary-50 在暗色下仍是 #ebf1ff，选中行会变成白底白字。
  // 这里逐行检查，带 dark: 变体的文件类型分类色（FileThumbnail）允许保留。
  const rawPalette = /(?:^|[\s"'"'`])(?:bg|text|border|ring)-(?:primary-(?:50|100|200)(?!\d)|emerald-\d{2,3}(?!\d)|amber-\d{2,3}(?!\d)|red-\d{2,3}(?!\d)|green-\d{2,3}(?!\d)|blue-\d{2,3}(?!\d)|orange-\d{2,3}(?!\d)|cyan-\d{2,3}(?!\d)|slate-\d{2,3}(?!\d)|gray-\d{2,3}(?!\d)|zinc-\d{2,3}(?!\d)|neutral-\d{2,3}(?!\d)|stone-\d{2,3}(?!\d))(?:\/\d+)?/g;
  const paleToken = /var\(--color-primary-(?:50|100|200)\)/;
  const primaryGradient = /(?:from|to|via)-primary-(?:500|700)/;
  const webPaletteHits = [];
  for (const file of webVueFiles) {
    const rel = path.relative(root, file);
    const code = stripComments(fs.readFileSync(file, "utf8"));
    for (const [index, line] of code.split(/\r?\n/).entries()) {
      if (line.includes("dark:")) continue;
      for (const match of line.matchAll(rawPalette)) {
        webPaletteHits.push(`${rel}:${index + 1} ${match[0].trim()}`);
      }
      if (paleToken.test(line)) webPaletteHits.push(`${rel}:${index + 1} var(--color-primary-50/100/200)`);
      if (primaryGradient.test(line)) webPaletteHits.push(`${rel}:${index + 1} primary-500/700 渐变`);
    }
  }
  if (webPaletteHits.length === 0) {
    pass("web .vue 未使用未适配暗色的浅色调色板类");
  } else {
    fail(`web .vue 存在未适配暗色的浅色调色板类：${webPaletteHits.slice(0, 8).join("；")}`);
  }
}
if (platforms.includes("desktop")) {
  const desktopDir = resolveRepoDir("x-pan-desktop/src");
  const desktopViewsDir = resolveRepoDir("x-pan-desktop/src/views");
  collectCssVarProblems("desktop", sources.desktop, [
    sourcePaths.desktop,
    ...walkFiles(desktopViewsDir, [".vue"]),
  ]);
  if (!desktopDir) fail("desktop 缺少 src 目录");
}

// 4. 历史遗留值不能再回来
function forbid(source, pattern, message) {
  if (pattern.test(source)) fail(message);
  else pass(message);
}

if (platforms.includes("web")) {
  forbid(codeSources.web, /vardanger|varsuccess|varwarning/, "web 不再出现 vardanger/varsuccess/varwarning");
  forbid(codeSources.web, /#0071e3/i, "web 不再使用旧桌面端品牌色 #0071e3");
}

if (platforms.includes("desktop")) {
  forbid(
    codeSources.desktop,
    /#0071e3|#0077ed|#e8f2ff|#f5f5f7|#ececf0|#86868b|#e5e5ea/i,
    "desktop 不再回退旧 Apple 调色板"
  );

  const rawPalette =
    /(?:^|[\s"'`])(?:bg|text|border|ring|from|to)-(red|green|amber|violet|blue|slate|gray|zinc|stone|neutral)-\d{2,3}(?:\/\d+)?/g;
  const desktopViews = walkFiles(resolveRepoDir("x-pan-desktop/src/views"), [".vue"]);
  const rawHits = [];
  for (const file of desktopViews) {
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(rawPalette)) rawHits.push(`${rel}: ${match[1]}`);
  }
  if (rawHits.length === 0) pass("desktop views 不再使用原始 Tailwind 调色板类");
  else fail(`desktop views 仍有原始调色板类：${rawHits.slice(0, 8).join("；")}`);
}

// 输出
console.log("X-Pan design token contract check");
console.log(`contract: ${contract.contract} (${contract.updated})`);
console.log(`root: ${root}`);
console.log(`platforms: ${platforms.join(", ")}`);
console.log(checks.join("\n"));
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nAll design token checks passed.");
}
