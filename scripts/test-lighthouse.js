const { spawn, spawnSync, execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const net = require("net");
const os = require("os");

function resolveLocalBin(binaryName) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? `${binaryName}.cmd` : binaryName;
  const binPath = path.join(process.cwd(), "node_modules", ".bin", executable);
  return binPath;
}

function resolveNodeScript(packageName, candidateSubpaths) {
  for (const subpath of candidateSubpaths) {
    try {
      return require.resolve(path.join(packageName, subpath));
    } catch (_) {
      // try next
    }
  }
  throw new Error(
    `Could not resolve CLI for ${packageName}. Tried: ${candidateSubpaths.join(
      ", "
    )}`
  );
}

function killProcessTreeCrossPlatform(childProcess) {
  if (!childProcess) return;
  try {
    if (process.platform === "win32") {
      // Best-effort kill of the full tree on Windows
      try {
        execSync(`taskkill /pid ${childProcess.pid} /T /F`);
      } catch (_) {
        try {
          childProcess.kill();
        } catch (_) {}
      }
    } else {
      // POSIX: try SIGTERM first
      try {
        childProcess.kill("SIGTERM");
      } catch (_) {}
    }
  } catch (_) {
    // ignore
  }
}

async function findAvailablePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close();
          resolve(port);
        });
        server.on("error", () => reject());
      });
      return port;
    } catch (error) {
      continue;
    }
  }
  throw new Error("No available ports found");
}

async function runLighthouseTests() {
  console.log("🔍 Running Lighthouse tests...");

  // Ensure dist directory exists
  if (!(await fs.pathExists("dist"))) {
    console.log('❌ Dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const testUrls = [
    { name: "Homepage", path: "index.html" },
    {
      name: "Engineering Responsibilities",
      path: "engineering_responsibilities.html",
    },
    { name: "Speaker Bio", path: "speaker-bio.html" },
  ];

  const results = [];
  // Prepare timestamped results directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsBaseDir = path.join(
    process.cwd(),
    "lighthouse-results",
    timestamp
  );
  await fs.ensureDir(resultsBaseDir);
  let serverProcess = null;
  let selectedPort = null;
  const httpServerScript = resolveNodeScript("http-server", [
    "bin/http-server",
    "bin/http-server.js",
  ]);
  const lighthouseScript = resolveNodeScript("lighthouse", ["cli/index.js"]);

  try {
    // Find an available port
    selectedPort = await findAvailablePort(3000);
    console.log(`🌐 Starting server on port ${selectedPort}...`);

    // Start HTTP server bound to localhost and enable SPA mode (-s)
    serverProcess = spawn(
      process.execPath,
      [
        httpServerScript,
        "dist",
        "-p",
        selectedPort.toString(),
        "-a",
        "127.0.0.1",
        "-s",
        "--silent",
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
        shell: false,
        cwd: process.cwd(),
      }
    );

    // Pipe server output for debugging
    serverProcess.stdout.on("data", (data) => {
      process.stdout.write(`[server] ${data}`);
    });
    serverProcess.stderr.on("data", (data) => {
      process.stderr.write(`[server:err] ${data}`);
    });

    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Test if server is responding
    try {
      const http = require("http");
      await new Promise((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${selectedPort}/index.html`,
          (res) => {
            console.log("✅ Server is running");
            resolve();
          }
        );
        req.on("error", (err) => {
          reject(new Error(`Server connection failed: ${err.message}`));
        });
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error("Server connection timeout"));
        });
      });
    } catch (error) {
      console.log("❌ Server failed to start properly:", error.message);
      throw error;
    }

    // Run tests
    for (const url of testUrls) {
      console.log(`\n📊 Testing ${url.name}...`);

      try {
        const testUrl = `http://localhost:${selectedPort}/${url.path}`;
        console.log(`Testing URL: ${testUrl}`);

        // Run Lighthouse with proper Chrome flags for Windows
        const slug = url.name.toLowerCase().replace(/\s+/g, "-");
        const resultFile = path.join(resultsBaseDir, `lighthouse-${slug}.json`);

        // Create an isolated Chrome user-data-dir to avoid LH cleanup races on Windows
        const tempProfileDir = path.join(
          os.tmpdir(),
          `lh-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        await fs.ensureDir(tempProfileDir);

        // Quote and normalize path for Windows Chrome flags
        const normalizedUserDataDir =
          process.platform === "win32"
            ? `"${tempProfileDir.replace(/\\/g, "/")}"`
            : tempProfileDir;

        const chromeFlags = [
          "--headless",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--no-first-run",
          "--disable-extensions",
          `--user-data-dir=${normalizedUserDataDir}`,
        ].join(" ");

        const lighthouseArgs = [
          testUrl,
          "--output=json",
          `--output-path=${resultFile}`,
          `--chrome-flags=${chromeFlags}`,
          "--only-categories=performance,accessibility,best-practices,seo",
        ];

        // Use spawnSync to avoid throwing; we'll read the result file even if exit code != 0
        const env = { ...process.env };
        if (process.platform === "win32") {
          const sys32 = "C\\\\Windows\\\\System32";
          const windowsDir = "C\\\\Windows";
          const pathSep = ";";
          const parts = (env.PATH || env.Path || "").split(pathSep);
          if (!parts.some((p) => p.toLowerCase() === sys32.toLowerCase())) {
            parts.unshift(sys32);
          }
          if (
            !parts.some((p) => p.toLowerCase() === windowsDir.toLowerCase())
          ) {
            parts.unshift(windowsDir);
          }
          env.PATH = parts.join(pathSep);
          env.Path = env.PATH;
        }

        const run = spawnSync(
          process.execPath,
          [lighthouseScript, ...lighthouseArgs],
          {
            stdio: "inherit",
            timeout: 90000,
            env,
          }
        );

        // Parse results (preserve JSON on disk)
        if (await fs.pathExists(resultFile)) {
          const result = JSON.parse(await fs.readFile(resultFile, "utf8"));

          // Check if the test was successful
          if (result.runtimeError) {
            console.log(`❌ Test failed: ${result.runtimeError.message}`);
            continue;
          }

          results.push({
            name: url.name,
            performance: result.categories.performance.score * 100,
            accessibility: result.categories.accessibility.score * 100,
            bestPractices: result.categories["best-practices"].score * 100,
            seo: result.categories.seo.score * 100,
          });

          console.log(`📝 Saved Lighthouse JSON: ${resultFile}`);
        } else if (run.error || run.status !== 0) {
          throw new Error(
            run.error?.message || `Lighthouse exited with code ${run.status}`
          );
        }

        // Attempt to clean up temp profile directory; ignore EBUSY
        const tryRemove = async (attempts = 3) => {
          for (let i = 0; i < attempts; i++) {
            try {
              await fs.remove(tempProfileDir);
              return;
            } catch (err) {
              if (i === attempts - 1) {
                console.warn(
                  `  ⚠️  Could not remove temp profile dir (in use): ${tempProfileDir}`
                );
                return;
              }
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        };
        await tryRemove();
      } catch (error) {
        console.log(`❌ Error testing ${url.name}:`, error.message);
      }
    }
  } catch (error) {
    console.log("❌ Setup failed:", error.message);
    console.log("\n💡 Trying alternative approach...");

    // Fallback to manual instructions
    console.log("\n📊 Manual Lighthouse Testing");
    console.log("Please test manually:");
    console.log("\n1️⃣  Open the built files in your browser:");
    console.log("   • Homepage: file://" + process.cwd() + "/dist/index.html");
    console.log(
      "   • Engineering Responsibilities: file://" +
        process.cwd() +
        "/dist/engineering_responsibilities.html"
    );
    console.log(
      "   • Speaker Bio: file://" + process.cwd() + "/dist/speaker-bio.html"
    );
    console.log("\n2️⃣  Run Lighthouse audits in DevTools (F12)");
    console.log("\n3️⃣  Check scores (target 90%+ for all categories)");
  } finally {
    // Clean up server
    if (serverProcess) {
      killProcessTreeCrossPlatform(serverProcess);
      console.log("🛑 Server stopped");
    }
  }

  // Display results if we have any
  if (results.length > 0) {
    console.log("\n📈 Lighthouse Test Results:");
    console.log("=".repeat(80));

    results.forEach((result) => {
      console.log(`\n${result.name}:`);
      console.log(`  Performance: ${result.performance.toFixed(1)}%`);
      console.log(`  Accessibility: ${result.accessibility.toFixed(1)}%`);
      console.log(`  Best Practices: ${result.bestPractices.toFixed(1)}%`);
      console.log(`  SEO: ${result.seo.toFixed(1)}%`);
    });

    // Check for issues
    const issues = results.filter(
      (r) =>
        r.performance < 90 ||
        r.accessibility < 90 ||
        r.bestPractices < 90 ||
        r.seo < 90
    );

    if (issues.length > 0) {
      console.log("\n⚠️  Issues found:");
      issues.forEach((issue) => {
        console.log(`  ${issue.name}:`);
        if (issue.performance < 90)
          console.log(
            `    - Performance: ${issue.performance.toFixed(1)}% (target: 90%)`
          );
        if (issue.accessibility < 90)
          console.log(
            `    - Accessibility: ${issue.accessibility.toFixed(
              1
            )}% (target: 90%)`
          );
        if (issue.bestPractices < 90)
          console.log(
            `    - Best Practices: ${issue.bestPractices.toFixed(
              1
            )}% (target: 90%)`
          );
        if (issue.seo < 90)
          console.log(`    - SEO: ${issue.seo.toFixed(1)}% (target: 90%)`);
      });
      process.exit(1);
    } else {
      console.log("\n✅ All tests passed!");
    }
  } else {
    console.log("\n✅ Build completed successfully!");
    console.log("Your website is ready for testing.");
  }
}

runLighthouseTests().catch(console.error);
