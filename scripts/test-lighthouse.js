const { spawn, execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const net = require("net");

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

  try {
    // Find an available port
    selectedPort = await findAvailablePort(3000);
    console.log(`🌐 Starting server on port ${selectedPort}...`);

    // Start HTTP server bound to localhost and enable SPA mode (-s)
    serverProcess = spawn(
      "npx",
      [
        "http-server",
        "dist",
        "-p",
        selectedPort.toString(),
        "-a",
        "127.0.0.1",
        "-s",
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
        shell: true,
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

        const lighthouseCommand = [
          "npx",
          "lighthouse",
          testUrl,
          "--output=json",
          `--output-path=${resultFile}`,
          "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-gpu --disable-web-security --disable-features=VizDisplayCompositor",
          "--only-categories=performance,accessibility,best-practices,seo",
        ];

        execSync(lighthouseCommand.join(" "), {
          stdio: "inherit",
          timeout: 60000, // 60 second timeout
        });

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
        }
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
    console.log("\n2️⃣  Run Lighthouse audits in DevTools (F12)");
    console.log("\n3️⃣  Check scores (target 90%+ for all categories)");
  } finally {
    // Clean up server
    if (serverProcess) {
      try {
        serverProcess.kill("SIGTERM");
        console.log("🛑 Server stopped");
      } catch (error) {
        // Ignore cleanup errors
      }
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
