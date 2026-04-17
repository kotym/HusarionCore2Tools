const vscode = require("vscode");
const cp = require("child_process");
const fsp = require("fs/promises");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

let outputChannel;

const DEFAULT_UPDATE_REPOSITORY = "kotym/HusarionCore2Tools";
const UPDATE_LAST_CHECK_KEY = "husarionCore2.update.lastCheckMs";
const UPDATE_SKIPPED_VERSION_KEY = "husarionCore2.update.skippedVersion";

function getFirstLine(text) {
  if (!text) return "";
  const line = text.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || "";
}

function normalizeGithubRepository(repoValue) {
  const raw = String(repoValue || "").trim();
  if (!raw) {
    return "";
  }

  const withoutGitSuffix = raw.replace(/\.git$/i, "");
  const directMatch = withoutGitSuffix.match(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  if (directMatch) {
    return directMatch[0];
  }

  const urlMatch = withoutGitSuffix.match(/github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return "";
}

function normalizeVersion(versionText) {
  return String(versionText || "")
    .trim()
    .replace(/^v/i, "")
    .split("+")[0]
    .split("-")[0];
}

function compareVersions(leftVersion, rightVersion) {
  const leftParts = normalizeVersion(leftVersion).split(".").map((p) => parseInt(p, 10));
  const rightParts = normalizeVersion(rightVersion).split(".").map((p) => parseInt(p, 10));
  const maxLen = Math.max(leftParts.length, rightParts.length, 3);

  for (let i = 0; i < maxLen; i += 1) {
    const left = Number.isFinite(leftParts[i]) ? leftParts[i] : 0;
    const right = Number.isFinite(rightParts[i]) ? rightParts[i] : 0;
    if (left > right) {
      return 1;
    }
    if (left < right) {
      return -1;
    }
  }

  return 0;
}

function getJsonFromUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "HusarionCore2Tools-UpdateChecker",
          Accept: "application/vnd.github+json"
        }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          const status = response.statusCode || 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP ${status}: ${body.slice(0, 200)}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Invalid JSON response from ${url}: ${err?.message || String(err)}`));
          }
        });
      }
    );

    request.setTimeout(10000, () => {
      request.destroy(new Error("Request timeout"));
    });

    request.on("error", (err) => reject(err));
  });
}

async function getLatestGitHubRelease(repo) {
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const release = await getJsonFromUrl(apiUrl);
  if (!release || typeof release.tag_name !== "string" || !release.tag_name.trim()) {
    throw new Error("GitHub release payload does not include tag_name");
  }
  return release;
}

function quotePowerShellArg(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

async function startUpdateInstaller(context, repo, targetVersion, options = {}) {
  const scriptPath = path.join(__dirname, "scripts", "update-from-github.ps1");
  if (!(await pathExists(scriptPath))) {
    throw new Error(`Update installer not found: ${scriptPath}`);
  }

  // Run updater from a temp copy so extension self-update does not touch the executing script file.
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "husarion-core2-updater-"));
  const tempScriptPath = path.join(tempDir, "update-from-github.ps1");
  await fsp.copyFile(scriptPath, tempScriptPath);

  const cfg = getConfig();
  const currentHframeworkPath = String(cfg.hframeworkPath || process.env.HFRAMEWORK_PATH || "").trim();
  const deleteOldInstall = Boolean(options.deleteOldInstall);
  const extensionId = `${context.extension.packageJSON.publisher}.${context.extension.packageJSON.name}`;
  const terminal = vscode.window.createTerminal({
    name: "Husarion CORE2 Update"
  });

  terminal.show(true);
  outputChannel.appendLine(`Update script copied to temp path: ${tempScriptPath}`);
  terminal.sendText([
    "powershell",
    "-ExecutionPolicy", "Bypass",
    "-File", quotePowerShellArg(tempScriptPath),
    "-GitHubRepo", quotePowerShellArg(repo),
    "-TargetVersion", quotePowerShellArg(targetVersion),
    "-ExtensionId", quotePowerShellArg(extensionId),
    "-CurrentHframeworkPath", quotePowerShellArg(currentHframeworkPath),
    deleteOldInstall ? "-DeleteOldInstall" : ""
  ].join(" "));
}

async function checkForUpdates(context, options = {}) {
  const manual = Boolean(options.manual);
  const cfg = vscode.workspace.getConfiguration("husarionCore2");
  const isEnabled = cfg.get("checkUpdatesOnStartup", true);
  if (!manual && !isEnabled) {
    return;
  }

  const now = Date.now();
  await context.globalState.update(UPDATE_LAST_CHECK_KEY, now);

  const configuredRepo = normalizeGithubRepository(cfg.get("updateRepository", DEFAULT_UPDATE_REPOSITORY));
  const repo = configuredRepo || DEFAULT_UPDATE_REPOSITORY;

  let release;
  try {
    release = await getLatestGitHubRelease(repo);
  } catch (err) {
    if (manual) {
      vscode.window.showErrorMessage(`Update check failed: ${err?.message || String(err)}`);
    } else {
      outputChannel.appendLine(`Update check skipped: ${err?.message || String(err)}`);
    }
    return;
  }

  const currentVersion = String(context.extension.packageJSON.version || "0.0.0");
  const latestVersion = String(release.tag_name || "").trim();
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    if (manual) {
      vscode.window.showInformationMessage(`Husarion CORE2 Tools is up to date (${currentVersion}).`);
    }
    return;
  }

  const skippedVersion = String(context.globalState.get(UPDATE_SKIPPED_VERSION_KEY, ""));
  if (!manual && compareVersions(latestVersion, skippedVersion) === 0) {
    return;
  }

  const installAndDeleteLabel = "Install update (delete old install)";
  const installAndKeepLabel = "Install update (keep old install)";
  const skipLabel = "Skip this version";
  const openReleaseLabel = "Open release notes";

  const choice = await vscode.window.showInformationMessage(
    `A newer Husarion CORE2 Tools release is available (${latestVersion}, current ${currentVersion}).`,
    installAndDeleteLabel,
    installAndKeepLabel,
    skipLabel,
    openReleaseLabel
  );

  if (choice === skipLabel) {
    await context.globalState.update(UPDATE_SKIPPED_VERSION_KEY, latestVersion);
    return;
  }

  if (choice === openReleaseLabel && release.html_url) {
    await vscode.env.openExternal(vscode.Uri.parse(String(release.html_url)));
    return;
  }

  if (choice === installAndDeleteLabel || choice === installAndKeepLabel) {
    await context.globalState.update(UPDATE_SKIPPED_VERSION_KEY, "");
    await startUpdateInstaller(context, repo, latestVersion, {
      deleteOldInstall: choice === installAndDeleteLabel
    });
    vscode.window.showInformationMessage("Update installer started in terminal. Reload VS Code after installation completes.");
  }
}

async function checkForUpdatesOnStartup(context) {
  outputChannel.appendLine("Startup update check running...");
  await checkForUpdates(context, { manual: false });
}

async function checkForUpdatesCommand(context) {
  await checkForUpdates(context, { manual: true });
}

function tryWhereExe(name) {
  try {
    const result = cp.spawnSync("where", [name], { encoding: "utf8", windowsHide: true, shell: true });
    if (result.status === 0) {
      const first = getFirstLine(result.stdout || "");
      if (first) {
        return first;
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function resolveExecutablePath(name, candidates = []) {
  const fromWhere = tryWhereExe(name);
  if (fromWhere) {
    return fromWhere;
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to command name for environments where PATH is configured at runtime.
  return name;
}

function findFileUnderRoots(fileName, roots, maxDepth = 5) {
  const target = fileName.toLowerCase();

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) {
      continue;
    }

    const stack = [{ dir: root, depth: 0 }];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      let entries = [];
      try {
        entries = fs.readdirSync(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current.dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === target) {
          return fullPath;
        }
        if (entry.isDirectory() && current.depth < maxDepth) {
          stack.push({ dir: fullPath, depth: current.depth + 1 });
        }
      }
    }
  }

  return "";
}

function getResolvedToolPaths() {
  const wingetLinksDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links")
    : "";

  const armRoots = [
    "C:\\Program Files (x86)\\Arm GNU Toolchain arm-none-eabi",
    "C:\\Program Files\\Arm GNU Toolchain arm-none-eabi",
    "C:\\Program Files (x86)\\GNU Arm Embedded Toolchain",
    "C:\\Program Files\\GNU Arm Embedded Toolchain"
  ];

  const autoArmGpp = findFileUnderRoots("arm-none-eabi-g++.exe", armRoots);
  const autoArmGcc = findFileUnderRoots("arm-none-eabi-gcc.exe", armRoots);

  return {
    cmake: resolveExecutablePath("cmake", [
      wingetLinksDir ? path.join(wingetLinksDir, "cmake.exe") : "",
      "C:\\Program Files\\CMake\\bin\\cmake.exe",
      "C:\\ProgramData\\chocolatey\\bin\\cmake.exe"
    ]),
    ninja: resolveExecutablePath("ninja", [
      wingetLinksDir ? path.join(wingetLinksDir, "ninja.exe") : "",
      "C:\\ProgramData\\chocolatey\\bin\\ninja.exe",
      "C:\\Program Files\\ninja\\ninja.exe"
    ]),
    armGpp: resolveExecutablePath("arm-none-eabi-g++", [
      wingetLinksDir ? path.join(wingetLinksDir, "arm-none-eabi-g++.exe") : "",
      "C:\\ProgramData\\chocolatey\\bin\\arm-none-eabi-g++.exe",
      autoArmGpp
    ]),
    armGcc: resolveExecutablePath("arm-none-eabi-gcc", [
      wingetLinksDir ? path.join(wingetLinksDir, "arm-none-eabi-gcc.exe") : "",
      "C:\\ProgramData\\chocolatey\\bin\\arm-none-eabi-gcc.exe",
      autoArmGcc
    ])
  };
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("husarionCore2");
  const hframeworkPath = cfg.get("hframeworkPath", "");
  const templateOverride = cfg.get("templatePath", "");
  const flasherOverride = cfg.get("flasherPath", "");
  const boardType = cfg.get("boardType", "core2");
  const openProjectInNewWindow = cfg.get("openProjectInNewWindow", false);
  const hSensorsPath = cfg.get("hSensorsPath", "");
  const hModulesPath = cfg.get("hModulesPath", "");

  return {
    hframeworkPath,
    templateOverride,
    flasherOverride,
    boardType,
    openProjectInNewWindow,
    hSensorsPath,
    hModulesPath
  };
}

function normalizeForCMake(p) {
  return p.replace(/\\/g, "/");
}

async function pathExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function readTextIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return "";
  }
  return fsp.readFile(filePath, "utf8");
}

async function getFileMtimeMs(filePath) {
  try {
    const st = await fsp.stat(filePath);
    return st.mtimeMs;
  } catch {
    return 0;
  }
}

async function shouldRunCmakeConfigure(sourceDir, buildDir) {
  const cachePath = path.join(buildDir, "CMakeCache.txt");
  const ninjaPath = path.join(buildDir, "build.ninja");
  if (!(await pathExists(cachePath)) || !(await pathExists(ninjaPath))) {
    return true;
  }

  const sourceCmake = path.join(sourceDir, "CMakeLists.txt");
  const cacheMtime = await getFileMtimeMs(cachePath);
  const sourceCmakeMtime = await getFileMtimeMs(sourceCmake);

  return sourceCmakeMtime > cacheMtime;
}

function normalizePathForCompare(p) {
  return path.normalize(String(p || "")).replace(/[\\/]+$/, "").toLowerCase();
}

async function removeDirectoryIfExists(dirPath) {
  if (!(await pathExists(dirPath))) {
    return;
  }
  await fsp.rm(dirPath, { recursive: true, force: true });
}

async function readCmakeCacheHomeDirectory(buildDir) {
  const cachePath = path.join(buildDir, "CMakeCache.txt");
  const text = await readTextIfExists(cachePath);
  if (!text) {
    return "";
  }

  const m = text.match(/^CMAKE_HOME_DIRECTORY:INTERNAL=(.+)$/m);
  if (!m || !m[1]) {
    return "";
  }

  return path.normalize(m[1].trim());
}

async function ensureBuildDirMatchesSource(sourceDir, buildDir, label) {
  const cachedHome = await readCmakeCacheHomeDirectory(buildDir);
  if (!cachedHome) {
    return false;
  }

  const currentNormalized = normalizePathForCompare(sourceDir);
  const cachedNormalized = normalizePathForCompare(cachedHome);
  if (currentNormalized === cachedNormalized) {
    return false;
  }

  outputChannel.appendLine(
    `Detected stale ${label} build cache. Cached source='${cachedHome}', current='${sourceDir}'. Cleaning '${buildDir}'.`
  );
  await removeDirectoryIfExists(buildDir);
  await ensureDir(buildDir);
  return true;
}

async function resolveHframeworkPath(projectRoot, cfg) {
  const candidates = [];
  const fromConfig = (cfg.hframeworkPath || "").trim();
  if (fromConfig) {
    candidates.push(fromConfig);
  }

  if (projectRoot) {
    const projectCMake = path.join(projectRoot, "CMakeLists.txt");
    const text = await readTextIfExists(projectCMake);
    const m = text.match(/set\s*\(\s*HFRAMEWORK_PATH\s+"?([^\)"]+)"?\s*\)/i);
    if (m && m[1]) {
      candidates.push(m[1]);
    }
  }

  const fromEnv = process.env.HFRAMEWORK_PATH;
  if (fromEnv && fromEnv.trim()) {
    candidates.push(fromEnv.trim());
  }

  if (projectRoot) {
    const parent = path.dirname(projectRoot);
    candidates.push(path.join(parent, "hFramework"));
    candidates.push(path.join(parent, "hFramework-master"));
  }

  const folders = vscode.workspace.workspaceFolders || [];
  for (const f of folders) {
    candidates.push(f.uri.fsPath);
  }

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (await pathExists(path.join(normalized, "hFramework.cmake"))) {
      return normalized;
    }
  }

  return "";
}

function getTemplatePath(hframeworkPath, cfg) {
  const override = (cfg.templateOverride || "").trim();
  if (override) {
    return override;
  }
  return path.join(hframeworkPath, "project_template");
}

function getFlasherPath(hframeworkPath, cfg) {
  const override = (cfg.flasherOverride || "").trim();
  if (override) {
    return override;
  }
  return path.join(hframeworkPath, "tools", "win", "core2-flasher.exe");
}

async function copyDirectory(src, dest) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function patchProjectCMake(projectDir, projectName, hframeworkPath) {
  const cmakePath = path.join(projectDir, "CMakeLists.txt");
  if (!(await pathExists(cmakePath))) {
    return;
  }

  let text = await fsp.readFile(cmakePath, "utf8");
  text = text.replace(/\r\n/g, "\n");

  const hfPathNormalized = normalizeForCMake(hframeworkPath);
  const parentDir = path.dirname(hframeworkPath);
  const defaultSensorsCandidates = [
    path.join(parentDir, "hSensors"),
    path.join(parentDir, "hSensors-master")
  ];
  const defaultModulesCandidates = [
    path.join(parentDir, "hModules"),
    path.join(parentDir, "modules-master"),
    path.join(parentDir, "hModules-master")
  ];
  let defaultSensorsPath = "";
  let defaultModulesPath = "";
  for (const p of defaultSensorsCandidates) {
    if (await pathExists(p)) {
      defaultSensorsPath = p;
      break;
    }
  }
  for (const p of defaultModulesCandidates) {
    if (await pathExists(p)) {
      defaultModulesPath = p;
      break;
    }
  }

  text = text.replace(/^\s*cmake_minimum_required\s*\([^\)]*\)\s*\n?/gim, "");
  text = text.replace(/^\s*set\s*\(\s*HFRAMEWORK_PATH\s+[^\)]*\)\s*\n?/gim, "");
  text = text.replace(/^\s*set\s*\(\s*HSENSORS_PATH\s+[^\)]*\)\s*\n?/gim, "");
  text = text.replace(/^\s*set\s*\(\s*HMODULES_PATH\s+[^\)]*\)\s*\n?/gim, "");
  text = text.replace(/^\s*\n+/, "");

  const header = [
    "cmake_minimum_required(VERSION 3.10)",
    `set(HFRAMEWORK_PATH \"${hfPathNormalized}\")`
  ];

  if (defaultSensorsPath) {
    header.push(`set(HSENSORS_PATH \"${normalizeForCMake(defaultSensorsPath)}\")`);
  }
  if (defaultModulesPath) {
    header.push(`set(HMODULES_PATH \"${normalizeForCMake(defaultModulesPath)}\")`);
  }

  text = `${header.join("\n")}\n\n${text}`;
  text = text.replace(/add_hexecutable\s*\(\s*myproject\b/i, `add_hexecutable(${projectName}`);

  if (/project\s*\(\s*ARoboCoreProject\b/i.test(text)) {
    text = text.replace(/project\s*\(\s*ARoboCoreProject\b/i, `project(${projectName}`);
  }

  await fsp.writeFile(cmakePath, text, "utf8");
}

function upsertCMakeSetVar(text, varName, value) {
  const normalized = normalizeForCMake(value);
  const re = new RegExp(`^\\s*set\\s*\\(\\s*${varName}\\s+[^\\)]*\\)\\s*$`, "gim");

  if (re.test(text)) {
    return text.replace(re, `set(${varName} "${normalized}")`);
  }

  const includeRe = /include\s*\(\s*\$\{HFRAMEWORK_PATH\}\/hFramework\.cmake\s*\)/i;
  if (includeRe.test(text)) {
    return text.replace(includeRe, `set(${varName} "${normalized}")\n$&`);
  }

  return `set(${varName} "${normalized}")\n${text}`;
}

async function syncProjectCMakePaths(projectRoot, cfg, resolvedModulePaths) {
  const cmakePath = path.join(projectRoot, "CMakeLists.txt");
  if (!(await pathExists(cmakePath))) {
    return;
  }

  let text = await fsp.readFile(cmakePath, "utf8");
  const original = text;

  text = upsertCMakeSetVar(text, "HFRAMEWORK_PATH", cfg.hframeworkPath);

  if (resolvedModulePaths.hSensors) {
    text = upsertCMakeSetVar(text, "HSENSORS_PATH", resolvedModulePaths.hSensors);
  }

  if (resolvedModulePaths.hModules) {
    text = upsertCMakeSetVar(text, "HMODULES_PATH", resolvedModulePaths.hModules);
  }

  if (text !== original) {
    await fsp.writeFile(cmakePath, text, "utf8");
    outputChannel.appendLine(`Updated project CMake paths in ${cmakePath}`);
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const pretty = `${command} ${args.join(" ")}`;
    outputChannel.appendLine(`> ${pretty}`);
    let outputTail = "";

    const appendTail = (text) => {
      outputTail += text;
      if (outputTail.length > 12000) {
        outputTail = outputTail.slice(-12000);
      }
    };

    const child = cp.spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    child.stdout.on("data", (d) => {
      const text = d.toString();
      outputChannel.append(text);
      appendTail(text);
    });
    child.stderr.on("data", (d) => {
      const text = d.toString();
      outputChannel.append(text);
      appendTail(text);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const trimmedTail = outputTail.trim();
        const details = trimmedTail ? `\n${trimmedTail}` : "";
        reject(new Error(`Command failed (${code}): ${pretty}${details}`));
      }
    });
  });
}

function isMissingLibraryLinkError(err) {
  const msg = String(err && err.message ? err.message : err || "");
  return /cannot find -lhFramework|cannot find -lhSensors|cannot find -lhModules/i.test(msg);
}

function isStaleCmakeBuildPathError(err) {
  const msg = String(err && err.message ? err.message : err || "").toLowerCase();
  return msg.includes("does not appear to contain cmakelists.txt")
    || (msg.includes("the source directory") && msg.includes("cmakelists"))
    || (msg.includes("--regenerate-during-build") && msg.includes("subcommand failed"))
    || (msg.includes("cmakecache.txt") && msg.includes("different source"));
}

async function showBuildErrorWithRebuildSuggestion(prefix, err) {
  const message = String(err && err.message ? err.message : err || "");
  if (!isStaleCmakeBuildPathError(message)) {
    vscode.window.showErrorMessage(`${prefix}: ${message}`);
    return;
  }

  const choice = await vscode.window.showErrorMessage(
    `${prefix}: stale CMake/build paths were detected (often after moving installation folders). Run full rebuild now?`,
    "Rebuild now",
    "Show details"
  );

  if (choice === "Rebuild now") {
    await rebuildProjectCommand();
    return;
  }

  if (choice === "Show details") {
    vscode.window.showErrorMessage(`${prefix}: ${message}`);
  }
}

function boardTypeToDefineValue(boardType) {
  switch (String(boardType || "").toLowerCase()) {
    case "robocore":
      return "2";
    case "core2":
      return "3";
    case "core2mini":
      return "4";
    default:
      return "";
  }
}

function getFallbackCppDefines(boardType) {
  const defines = ["PORT=stm32", "SUPPORT_CPLUSPLUS"];
  const boardDefine = boardTypeToDefineValue(boardType);
  if (boardDefine) {
    defines.unshift(`BOARD_TYPE=${boardDefine}`);
  }
  return defines;
}

function normalizeCppStandard(standardValue, fallbackValue) {
  if (!standardValue) {
    return fallbackValue;
  }

  const value = String(standardValue).trim().toLowerCase();
  const exact = {
    "c++98": "c++98",
    "gnu++98": "gnu++98",
    "c++03": "c++03",
    "gnu++03": "gnu++03",
    "c++11": "c++11",
    "gnu++11": "gnu++11",
    "c++14": "c++14",
    "gnu++14": "gnu++14",
    "c++17": "c++17",
    "gnu++17": "gnu++17",
    "c++20": "c++20",
    "gnu++20": "gnu++20",
    "c++23": "c++23",
    "gnu++23": "gnu++23",
    "c++2b": "c++23",
    "gnu++2b": "gnu++23"
  };

  if (exact[value]) {
    return exact[value];
  }

  const match = value.match(/(gnu\+\+|c\+\+)(98|03|11|14|17|20|23|2b)/);
  if (!match) {
    return fallbackValue;
  }

  const flavor = match[1];
  const version = match[2] === "2b" ? "23" : match[2];
  return `${flavor}${version}`;
}

function getCppStandardFromCmake(cmakeText) {
  const m = String(cmakeText || "").match(/set\s*\(\s*CMAKE_CXX_STANDARD\s+([0-9]+)\s*\)/i);
  if (!m || !m[1]) {
    return "";
  }
  return normalizeCppStandard(`c++${m[1]}`, "");
}

function parseCompileEntry(entry) {
  const defines = new Set();
  let standard = "";

  if (Array.isArray(entry && entry.arguments)) {
    for (let i = 0; i < entry.arguments.length; i += 1) {
      const token = String(entry.arguments[i] || "");
      if (token === "-D") {
        const next = String(entry.arguments[i + 1] || "").trim();
        if (next) {
          defines.add(next);
        }
        i += 1;
      } else if (token.startsWith("-D")) {
        const value = token.slice(2).trim();
        if (value) {
          defines.add(value);
        }
      } else if (token.startsWith("-std=")) {
        standard = token.slice(5).trim();
      }
    }
  }

  if (typeof (entry && entry.command) === "string") {
    const cmd = entry.command;
    const defineRe = /(?:^|\s)-D([^\s"']+|"[^"]+")/g;
    let dm;
    while ((dm = defineRe.exec(cmd)) !== null) {
      const raw = String(dm[1] || "").trim();
      const cleaned = raw.replace(/^"|"$/g, "");
      if (cleaned) {
        defines.add(cleaned);
      }
    }

    const stdRe = /(?:^|\s)-std=([^\s]+)/g;
    let sm;
    while ((sm = stdRe.exec(cmd)) !== null) {
      standard = String(sm[1] || "").trim();
    }
  }

  return {
    defines: [...defines],
    standard
  };
}

async function getCppToolsMetadata(projectRoot, cmakeText, boardType) {
  const compileCommandsPath = path.join(projectRoot, "build", "compile_commands.json");
  const fallbackDefines = getFallbackCppDefines(boardType);
  const fallbackStandard = getCppStandardFromCmake(cmakeText) || "c++11";

  const defineSet = new Set(fallbackDefines);
  let cppStandard = fallbackStandard;

  if (await pathExists(compileCommandsPath)) {
    try {
      const raw = await fsp.readFile(compileCommandsPath, "utf8");
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const parsed = parseCompileEntry(entry);
          for (const d of parsed.defines) {
            defineSet.add(d);
          }
          cppStandard = normalizeCppStandard(parsed.standard, cppStandard);
        }
      }
    } catch (err) {
      outputChannel.appendLine(`Warning: cannot parse compile_commands.json for IntelliSense metadata: ${err}`);
    }
  }

  return {
    defines: [...defineSet],
    cppStandard
  };
}

function mergeUniquePaths(paths) {
  const out = [];
  const seen = new Set();

  for (const p of paths) {
    if (!p) {
      continue;
    }

    const normalized = normalizeForCMake(String(p).trim());
    if (!normalized) {
      continue;
    }

    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(normalized);
  }

  return out;
}

async function getIncludePathsFromCompileCommands(projectRoot) {
  const compileCommandsPath = path.join(projectRoot, "build", "compile_commands.json");
  if (!(await pathExists(compileCommandsPath))) {
    return [];
  }

  const includePaths = [];

  try {
    const raw = await fsp.readFile(compileCommandsPath, "utf8");
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) {
      return [];
    }

    for (const entry of entries) {
      if (Array.isArray(entry && entry.arguments)) {
        for (let i = 0; i < entry.arguments.length; i += 1) {
          const token = String(entry.arguments[i] || "").trim();
          if (token === "-I") {
            const next = String(entry.arguments[i + 1] || "").trim();
            if (next) {
              includePaths.push(next.replace(/^\"|\"$/g, ""));
            }
            i += 1;
          } else if (token.startsWith("-I")) {
            const value = token.slice(2).trim();
            if (value) {
              includePaths.push(value.replace(/^\"|\"$/g, ""));
            }
          }
        }
      }

      if (typeof (entry && entry.command) === "string") {
        const includeRe = /(?:^|\s)-I([^\s"']+|"[^"]+")/g;
        let m;
        while ((m = includeRe.exec(entry.command)) !== null) {
          const rawPath = String(m[1] || "").trim();
          const cleaned = rawPath.replace(/^\"|\"$/g, "");
          if (cleaned) {
            includePaths.push(cleaned);
          }
        }
      }
    }
  } catch (err) {
    outputChannel.appendLine(`Warning: cannot parse compile_commands include paths: ${err}`);
    return [];
  }

  return mergeUniquePaths(includePaths);
}

function getHexTargetNameFromCMake(cmakeText, fallbackName) {
  const m = cmakeText.match(/add_hexecutable\s*\(\s*([A-Za-z0-9_.-]+)/i);
  if (m && m[1]) {
    return m[1];
  }
  return fallbackName;
}

function getEnabledModulesFromCMake(cmakeText) {
  const modules = [];
  const re = /enable_module\s*\(\s*([A-Za-z0-9_]+)\s*\)/ig;
  let m;
  while ((m = re.exec(cmakeText)) !== null) {
    modules.push(m[1]);
  }
  return modules;
}

async function resolveModulePath(moduleName, cfg) {
  const parent = path.dirname(cfg.hframeworkPath);
  const userCandidates = [];

  if (moduleName === "hSensors" && cfg.hSensorsPath && cfg.hSensorsPath.trim()) {
    userCandidates.push(cfg.hSensorsPath.trim());
  }
  if (moduleName === "hModules" && cfg.hModulesPath && cfg.hModulesPath.trim()) {
    userCandidates.push(cfg.hModulesPath.trim());
  }

  const autoCandidates = moduleName === "hSensors"
    ? [path.join(parent, "hSensors"), path.join(parent, "hSensors-master")]
    : [path.join(parent, "hModules"), path.join(parent, "modules-master"), path.join(parent, "hModules-master")];

  for (const p of [...userCandidates, ...autoCandidates]) {
    if (await pathExists(p)) {
      return p;
    }
  }

  return "";
}

async function getResolvedModulePaths(cfg) {
  return {
    hSensors: await resolveModulePath("hSensors", cfg),
    hModules: await resolveModulePath("hModules", cfg)
  };
}

async function ensureModuleBuilt(moduleName, modulePath, cfg) {
  const tools = getResolvedToolPaths();
  const moduleBuildDir = path.join(modulePath, "build", `stm32_${cfg.boardType}_1.0.0`);
  const expectedLib = path.join(moduleBuildDir, `lib${moduleName}.a`);

  await ensureDir(moduleBuildDir);
  await ensureBuildDirMatchesSource(modulePath, moduleBuildDir, moduleName);

  if (await shouldRunCmakeConfigure(modulePath, moduleBuildDir)) {
    await runCommand(tools.cmake, [
      "-S", modulePath,
      "-B", moduleBuildDir,
      "-GNinja",
      `-DCMAKE_MAKE_PROGRAM=${tools.ninja}`,
      `-DCMAKE_C_COMPILER=${tools.armGcc}`,
      `-DCMAKE_CXX_COMPILER=${tools.armGpp}`,
      `-DCMAKE_ASM_COMPILER=${tools.armGcc}`,
      `-DBOARD_TYPE=${cfg.boardType}`,
      `-DHFRAMEWORK_PATH=${cfg.hframeworkPath}`,
      "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
    ], modulePath);
  }

  // Ninja performs incremental builds; this will only rebuild if sources changed.
  await runCommand(tools.ninja, ["-C", moduleBuildDir, moduleName], modulePath);

  if (!(await pathExists(expectedLib))) {
    throw new Error(`Module ${moduleName} build completed but library not found: ${expectedLib}`);
  }
  outputChannel.appendLine(`Module ${moduleName} is up to date at ${expectedLib}`);
}

async function ensureFrameworkBuilt(cfg) {
  const tools = getResolvedToolPaths();
  if (!path.isAbsolute(tools.armGcc) || !path.isAbsolute(tools.armGpp)) {
    throw new Error("Could not resolve full paths to arm-none-eabi-gcc/g++. Please run Husarion: Install Required Toolchain and Components, then restart VS Code.");
  }
  const frameworkPath = cfg.hframeworkPath;
  const frameworkBuildDir = path.join(frameworkPath, "build", `stm32_${cfg.boardType}_1.0.0`);
  const expectedLib = path.join(frameworkBuildDir, "libhFramework.a");

  await ensureDir(frameworkBuildDir);
  await ensureBuildDirMatchesSource(frameworkPath, frameworkBuildDir, "hFramework");

  if (await shouldRunCmakeConfigure(frameworkPath, frameworkBuildDir)) {
    await runCommand(tools.cmake, [
      "-S", frameworkPath,
      "-B", frameworkBuildDir,
      "-GNinja",
      `-DCMAKE_MAKE_PROGRAM=${tools.ninja}`,
      `-DCMAKE_C_COMPILER=${tools.armGcc}`,
      `-DCMAKE_CXX_COMPILER=${tools.armGpp}`,
      `-DCMAKE_ASM_COMPILER=${tools.armGcc}`,
      `-DBOARD_TYPE=${cfg.boardType}`,
      "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
    ], frameworkPath);
  }

  // Ninja performs incremental builds; this will only rebuild if sources changed.
  await runCommand(tools.ninja, ["-C", frameworkBuildDir, "hFramework"], frameworkPath);

  if (!(await pathExists(expectedLib))) {
    throw new Error(`hFramework build completed but library not found: ${expectedLib}`);
  }

  outputChannel.appendLine(`hFramework is up to date at ${expectedLib}`);
}

function buildCppToolsConfiguration(name, includePath, compilerPath, intelliSenseMode, defines, cppStandard) {
  return {
    name,
    includePath,
    browse: {
      path: includePath,
      limitSymbolsToIncludedHeaders: false
    },
    defines,
    compilerPath,
    cStandard: "c11",
    cppStandard,
    intelliSenseMode,
    compileCommands: "${workspaceFolder}/build/compile_commands.json"
  };
}

async function ensureCppToolsConfig(projectRoot, cfg, moduleIncludePaths, compilerPath, cmakeText) {
  const vscodeDir = path.join(projectRoot, ".vscode");
  await ensureDir(vscodeDir);

  const metadata = await getCppToolsMetadata(projectRoot, cmakeText, cfg.boardType);
  const compileCommandIncludes = await getIncludePathsFromCompileCommands(projectRoot);

  const hf = cfg.hframeworkPath;
  const frameworkBuildDir = normalizeForCMake(path.join(hf, "build", `stm32_${cfg.boardType}_1.0.0`));
  const includePath = mergeUniquePaths([
    "${workspaceFolder}",
    "${workspaceFolder}/..",
    normalizeForCMake(path.join(hf, "include")),
    normalizeForCMake(path.join(hf, "src")),
    normalizeForCMake(path.join(hf, "src", "hSystem")),
    normalizeForCMake(path.join(hf, "src", "Other")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "include")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src", "hPeriph")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src", "hUSB", "usb")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src", "hUSB")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS", "include")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS", "portable", "GCC", "ARM_CM4F")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis_boot")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis_lib")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis_lib", "include")),
    normalizeForCMake(path.join(hf, "third-party", "usblib")),
    normalizeForCMake(path.join(hf, "third-party", "FatFS")),
    normalizeForCMake(path.join(hf, "third-party", "FatFS", "FATFS_include")),
    normalizeForCMake(path.join(hf, "third-party", "eeprom")),
    frameworkBuildDir,
    ...moduleIncludePaths,
    ...compileCommandIncludes
  ]);

  const config = {
    version: 4,
    configurations: [
      buildCppToolsConfiguration("Win32", includePath, compilerPath || "arm-none-eabi-g++.exe", "windows-gcc-x64", metadata.defines, metadata.cppStandard),
      buildCppToolsConfiguration("Linux", includePath, "/usr/bin/arm-none-eabi-g++", "linux-gcc-x64", metadata.defines, metadata.cppStandard),
      buildCppToolsConfiguration("Mac", includePath, "/usr/local/bin/arm-none-eabi-g++", "macos-gcc-x64", metadata.defines, metadata.cppStandard)
    ]
  };

  const outPath = path.join(vscodeDir, "c_cpp_properties.json");
  await fsp.writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function buildResolvedConfig(projectRoot) {
  const cfg = getConfig();
  const hframeworkPath = await resolveHframeworkPath(projectRoot, cfg);
  if (!hframeworkPath) {
    throw new Error("Cannot resolve hFramework path. Set husarionCore2.hframeworkPath in VS Code settings.");
  }

  return {
    ...cfg,
    hframeworkPath,
    templatePath: getTemplatePath(hframeworkPath, cfg),
    flasherPath: getFlasherPath(hframeworkPath, cfg)
  };
}

async function configureAndBuildProject(projectRoot, cfg) {
  const tools = getResolvedToolPaths();
  if (!path.isAbsolute(tools.armGcc) || !path.isAbsolute(tools.armGpp)) {
    throw new Error("Could not resolve full paths to arm-none-eabi-gcc/g++. Please run Husarion: Install Required Toolchain and Components, then restart VS Code.");
  }
  const buildDir = path.join(projectRoot, "build");
  await ensureDir(buildDir);
  await ensureBuildDirMatchesSource(projectRoot, buildDir, "project");

  const cmakePath = path.join(projectRoot, "CMakeLists.txt");
  let cmakeText = await readTextIfExists(cmakePath);
  const enabledModules = getEnabledModulesFromCMake(cmakeText);
  const moduleIncludePaths = [];

  await ensureFrameworkBuilt(cfg);

  const resolvedModulePaths = await getResolvedModulePaths(cfg);

  for (const modulePath of Object.values(resolvedModulePaths)) {
    if (!modulePath) {
      continue;
    }
    moduleIncludePaths.push(path.join(modulePath, "include"));
    moduleIncludePaths.push(path.join(modulePath, "src"));
  }

  await syncProjectCMakePaths(projectRoot, cfg, resolvedModulePaths);
  cmakeText = await readTextIfExists(cmakePath);

  const moduleBuildOrder = ["hSensors", "hModules"];
  for (const moduleName of moduleBuildOrder) {
    if (enabledModules.length > 0 && !enabledModules.includes(moduleName)) {
      continue;
    }
    const modulePath = resolvedModulePaths[moduleName];
    if (!modulePath) {
      outputChannel.appendLine(`Module ${moduleName} not found locally, skipping build`);
      continue;
    }
    await ensureModuleBuilt(moduleName, modulePath, cfg);
  }

  const cmakeArgs = [
    "-S", projectRoot,
    "-B", buildDir,
    "-GNinja",
    `-DCMAKE_MAKE_PROGRAM=${tools.ninja}`,
    `-DCMAKE_C_COMPILER=${tools.armGcc}`,
    `-DCMAKE_CXX_COMPILER=${tools.armGpp}`,
    `-DCMAKE_ASM_COMPILER=${tools.armGcc}`,
    `-DBOARD_TYPE=${cfg.boardType}`,
    `-DHFRAMEWORK_PATH=${cfg.hframeworkPath}`,
    "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
    "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
  ];

  if (resolvedModulePaths.hSensors) {
    cmakeArgs.push(`-DHSENSORS_PATH=${resolvedModulePaths.hSensors}`);
  } else {
    cmakeArgs.push("-UHSENSORS_PATH");
  }

  if (resolvedModulePaths.hModules) {
    cmakeArgs.push(`-DHMODULES_PATH=${resolvedModulePaths.hModules}`);
  } else {
    cmakeArgs.push("-UHMODULES_PATH");
  }

  await runCommand(tools.cmake, cmakeArgs, projectRoot);

  await ensureCppToolsConfig(projectRoot, cfg, moduleIncludePaths, tools.armGpp, cmakeText);

  const targetName = getHexTargetNameFromCMake(cmakeText, path.basename(projectRoot));
  try {
    await runCommand(tools.ninja, ["-C", buildDir, `${targetName}.hex`], projectRoot);
  } catch (err) {
    if (!isMissingLibraryLinkError(err)) {
      throw err;
    }

    outputChannel.appendLine("Detected missing static libraries during link. Rebuilding core libraries and retrying once...");

    await ensureFrameworkBuilt(cfg);
    for (const moduleName of ["hSensors", "hModules"]) {
      const modulePath = await resolveModulePath(moduleName, cfg);
      if (modulePath) {
        await ensureModuleBuilt(moduleName, modulePath, cfg);
      }
    }

    await runCommand(tools.ninja, ["-C", buildDir, `${targetName}.hex`], projectRoot);
  }
  return buildDir;
}

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const normalized = path.normalize(String(p || ""));
    if (!normalized) {
      continue;
    }
    const key = normalizePathForCompare(normalized);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

async function cleanAllBuildDirs(projectRoot, cfg) {
  const resolvedModulePaths = await getResolvedModulePaths(cfg);
  const buildDirs = uniquePaths([
    path.join(projectRoot, "build"),
    path.join(cfg.hframeworkPath, "build"),
    resolvedModulePaths.hSensors ? path.join(resolvedModulePaths.hSensors, "build") : "",
    resolvedModulePaths.hModules ? path.join(resolvedModulePaths.hModules, "build") : ""
  ]);

  for (const dirPath of buildDirs) {
    if (await pathExists(dirPath)) {
      outputChannel.appendLine(`Removing build directory: ${dirPath}`);
      await removeDirectoryIfExists(dirPath);
    }
  }
}

async function rebuildProjectCommand() {
  const root = getWorkspaceProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage("Open a Husarion project folder first.");
    return;
  }

  const cfg = await buildResolvedConfig(root);
  outputChannel.show(true);
  await cleanAllBuildDirs(root, cfg);
  await configureAndBuildProject(root, cfg);
  vscode.window.showInformationMessage("Rebuild completed and HEX generated.");
}

function getWorkspaceProjectRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  return folders[0].uri.fsPath;
}

async function createProjectCommand() {
  const workspaceRoot = getWorkspaceProjectRoot();
  const resolved = await buildResolvedConfig(workspaceRoot);
  const { templatePath, hframeworkPath, openProjectInNewWindow } = resolved;

  if (!(await pathExists(templatePath))) {
    vscode.window.showErrorMessage(`Template directory does not exist: ${templatePath}`);
    return;
  }

  const projectName = await vscode.window.showInputBox({
    prompt: "Enter new Husarion project name",
    placeHolder: "TestCore2",
    validateInput: (v) => {
      if (!v || !v.trim()) {
        return "Project name cannot be empty";
      }
      if (!/^[A-Za-z0-9_-]+$/.test(v.trim())) {
        return "Use letters, numbers, '_' or '-'";
      }
      return null;
    }
  });

  if (!projectName) {
    return;
  }

  const targetParent = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Select parent folder for new project"
  });

  if (!targetParent || targetParent.length === 0) {
    return;
  }

  const parentDir = targetParent[0].fsPath;
  const projectDir = path.join(parentDir, projectName);

  if (await pathExists(projectDir)) {
    vscode.window.showErrorMessage(`Target folder already exists: ${projectDir}`);
    return;
  }

  await copyDirectory(templatePath, projectDir);
  await patchProjectCMake(projectDir, projectName, hframeworkPath);
  const tools = getResolvedToolPaths();
  const moduleIncludePaths = [];
  for (const moduleName of ["hSensors", "hModules"]) {
    const modulePath = await resolveModulePath(moduleName, resolved);
    if (modulePath) {
      moduleIncludePaths.push(path.join(modulePath, "include"));
      moduleIncludePaths.push(path.join(modulePath, "src"));
    }
  }
  await ensureCppToolsConfig(projectDir, resolved, moduleIncludePaths, tools.armGpp, "");

  const openNow = await vscode.window.showInformationMessage(
    `Created project at ${projectDir}`,
    "Open Project"
  );

  if (openNow === "Open Project") {
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectDir), openProjectInNewWindow);
  }
}

async function findNewestHex(buildDir) {
  if (!(await pathExists(buildDir))) {
    return null;
  }

  const files = await fsp.readdir(buildDir);
  const hexCandidates = files.filter((f) => f.toLowerCase().endsWith(".hex"));
  if (hexCandidates.length === 0) {
    return null;
  }

  const stats = await Promise.all(
    hexCandidates.map(async (name) => {
      const fullPath = path.join(buildDir, name);
      const st = await fsp.stat(fullPath);
      return { fullPath, mtimeMs: st.mtimeMs };
    })
  );

  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats[0].fullPath;
}

async function flashProjectCommand() {
  const root = getWorkspaceProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage("Open a Husarion project folder first.");
    return;
  }

  const cfg = await buildResolvedConfig(root);
  const { flasherPath } = cfg;
  if (!(await pathExists(flasherPath))) {
    vscode.window.showErrorMessage(`Flasher not found: ${flasherPath}`);
    return;
  }

  outputChannel.show(true);
  const buildDir = await configureAndBuildProject(root, cfg);
  const hexPath = await findNewestHex(buildDir);
  if (!hexPath) {
    throw new Error("No .hex file found in build directory after build");
  }

  const flashTerminal = vscode.window.createTerminal({ name: "Husarion CORE2 Flash", cwd: root });
  flashTerminal.show(true);
  flashTerminal.sendText(`& \"${flasherPath}\" \"${hexPath}\"`);
}

async function buildProjectCommand() {
  const root = getWorkspaceProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage("Open a Husarion project folder first.");
    return;
  }

  const cfg = await buildResolvedConfig(root);
  outputChannel.show(true);
  await configureAndBuildProject(root, cfg);
  vscode.window.showInformationMessage("Build completed and HEX generated.");
}

async function flashOnlyCommand() {
  const root = getWorkspaceProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage("Open a Husarion project folder first.");
    return;
  }

  const cfg = await buildResolvedConfig(root);
  const { flasherPath } = cfg;
  if (!(await pathExists(flasherPath))) {
    vscode.window.showErrorMessage(`Flasher not found: ${flasherPath}`);
    return;
  }

  const buildDir = path.join(root, "build");
  const hexPath = await findNewestHex(buildDir);
  if (!hexPath) {
    throw new Error("No .hex file found. Run 'Husarion: Build Project (No Flash)' first.");
  }

  const flashTerminal = vscode.window.createTerminal({ name: "Husarion CORE2 Flash", cwd: root });
  flashTerminal.show(true);
  flashTerminal.sendText(`& \"${flasherPath}\" \"${hexPath}\"`);
}

async function openConsoleCommand() {
  const root = getWorkspaceProjectRoot();
  const cfg = await buildResolvedConfig(root);
  const { flasherPath } = cfg;

  if (!(await pathExists(flasherPath))) {
    vscode.window.showErrorMessage(`Flasher not found: ${flasherPath}`);
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: "Husarion CORE2 Console"
  });
  terminal.show(true);
  terminal.sendText(`& \"${flasherPath}\" --console`);
}

async function installDependenciesCommand() {
  const scriptPath = path.join(__dirname, "scripts", "install-or-refresh-toolchain.ps1");
  if (!(await pathExists(scriptPath))) {
    vscode.window.showErrorMessage(`Dependency installer not found: ${scriptPath}`);
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: "Husarion CORE2 Setup"
  });
  terminal.show(true);
  terminal.sendText(`powershell -ExecutionPolicy Bypass -File \"${scriptPath}\" -InstallCppToolsExtension`);
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("Husarion CORE2");

  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.createProject", () => {
      createProjectCommand().catch((err) => {
        vscode.window.showErrorMessage(`Create project failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.buildProject", () => {
      buildProjectCommand().catch((err) => {
        showBuildErrorWithRebuildSuggestion("Build failed", err).catch((handlerErr) => {
          vscode.window.showErrorMessage(`Build failed: ${handlerErr?.message || String(handlerErr)}`);
        });
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.flashProject", () => {
      flashProjectCommand().catch((err) => {
        showBuildErrorWithRebuildSuggestion("Flash failed", err).catch((handlerErr) => {
          vscode.window.showErrorMessage(`Flash failed: ${handlerErr?.message || String(handlerErr)}`);
        });
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.rebuildProject", () => {
      rebuildProjectCommand().catch((err) => {
        vscode.window.showErrorMessage(`Rebuild failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.flashOnly", () => {
      flashOnlyCommand().catch((err) => {
        vscode.window.showErrorMessage(`Flash failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.openConsole", () => {
      openConsoleCommand().catch((err) => {
        vscode.window.showErrorMessage(`Open console failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.installDependencies", () => {
      installDependenciesCommand().catch((err) => {
        vscode.window.showErrorMessage(`Dependency installation failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.checkForUpdates", () => {
      checkForUpdatesCommand(context).catch((err) => {
        vscode.window.showErrorMessage(`Update check failed: ${err?.message || String(err)}`);
      });
    })
  );

  setTimeout(() => {
    checkForUpdatesOnStartup(context).catch((err) => {
      outputChannel.appendLine(`Update check failed: ${err?.message || String(err)}`);
    });
  }, 1500);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
