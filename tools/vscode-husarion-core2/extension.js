const vscode = require("vscode");
const cp = require("child_process");
const fsp = require("fs/promises");
const fs = require("fs");
const path = require("path");

let outputChannel;

function getFirstLine(text) {
  if (!text) return "";
  const line = text.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || "";
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

    const child = cp.spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    child.stdout.on("data", (d) => outputChannel.append(d.toString()));
    child.stderr.on("data", (d) => outputChannel.append(d.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed (${code}): ${pretty}`));
      }
    });
  });
}

function isMissingLibraryLinkError(err) {
  const msg = String(err && err.message ? err.message : err || "");
  return /cannot find -lhFramework|cannot find -lhSensors|cannot find -lhModules/i.test(msg);
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

async function ensureModuleBuilt(moduleName, modulePath, cfg) {
  const tools = getResolvedToolPaths();
  const moduleBuildDir = path.join(modulePath, "build", `stm32_${cfg.boardType}_1.0.0`);
  const expectedLib = path.join(moduleBuildDir, `lib${moduleName}.a`);

  await ensureDir(moduleBuildDir);

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

function buildCppToolsConfiguration(name, includePath, compilerPath, intelliSenseMode) {
  return {
    name,
    includePath,
    browse: {
      path: includePath,
      limitSymbolsToIncludedHeaders: false
    },
    defines: [],
    compilerPath,
    cStandard: "c11",
    cppStandard: "c++11",
    intelliSenseMode,
    compileCommands: "${workspaceFolder}/build/compile_commands.json"
  };
}

async function ensureCppToolsConfig(projectRoot, cfg, moduleIncludePaths, compilerPath) {
  const vscodeDir = path.join(projectRoot, ".vscode");
  await ensureDir(vscodeDir);

  const hf = cfg.hframeworkPath;
  const includePath = [
    "${workspaceFolder}",
    normalizeForCMake(path.join(hf, "include")),
    normalizeForCMake(path.join(hf, "src")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "include")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src", "hPeriph")),
    normalizeForCMake(path.join(hf, "ports", "stm32", "src", "hUSB")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS", "include")),
    normalizeForCMake(path.join(hf, "third-party", "FreeRTOS", "portable", "GCC", "ARM_CM4F")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis_boot")),
    normalizeForCMake(path.join(hf, "third-party", "cmsis_lib")),
    normalizeForCMake(path.join(hf, "third-party", "usblib")),
    normalizeForCMake(path.join(hf, "third-party", "FatFS")),
    normalizeForCMake(path.join(hf, "third-party", "eeprom"))
  ];

  for (const p of moduleIncludePaths) {
    includePath.push(normalizeForCMake(p));
  }

  const config = {
    version: 4,
    configurations: [
      buildCppToolsConfiguration("Win32", includePath, compilerPath || "arm-none-eabi-g++.exe", "windows-gcc-x64"),
      buildCppToolsConfiguration("Linux", includePath, "/usr/bin/arm-none-eabi-g++", "linux-gcc-x64"),
      buildCppToolsConfiguration("Mac", includePath, "/usr/local/bin/arm-none-eabi-g++", "macos-gcc-x64")
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

  const cmakePath = path.join(projectRoot, "CMakeLists.txt");
  let cmakeText = await readTextIfExists(cmakePath);
  const enabledModules = getEnabledModulesFromCMake(cmakeText);
  const moduleIncludePaths = [];

  await ensureFrameworkBuilt(cfg);

  const resolvedModulePaths = {
    hSensors: await resolveModulePath("hSensors", cfg),
    hModules: await resolveModulePath("hModules", cfg)
  };

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
    moduleIncludePaths.push(path.join(modulePath, "include"));
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

  await ensureCppToolsConfig(projectRoot, cfg, moduleIncludePaths, tools.armGpp);

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
  await ensureCppToolsConfig(projectDir, resolved, [], tools.armGpp);

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
        vscode.window.showErrorMessage(`Build failed: ${err?.message || String(err)}`);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("husarionCore2.flashProject", () => {
      flashProjectCommand().catch((err) => {
        vscode.window.showErrorMessage(`Flash failed: ${err?.message || String(err)}`);
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
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
