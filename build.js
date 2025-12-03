#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const { glob } = require("glob");
const HtmlMinifier = require("html-minifier");
const CleanCSS = require("clean-css");
const { minify } = require("terser");
const { PurgeCSS } = require("purgecss");
const esbuild = require("esbuild");

const chokidar = require("chokidar");

// Configuration
const config = {
  sourceDir: ".",
  outputDir: "dist",
  htmlFiles: ["*.html"],
  cssFiles: ["css/**/*.css"],
  jsFiles: ["js/**/*.js"],
  excludeJsFiles: ["js/bootstrap.js", "js/bootstrap.min.js"], // Exclude Bootstrap JS
  imageFiles: ["img/**/*.{webp,svg,png,pdf}"], // Copy WebP, SVG, PNG, and PDF files
  copyFiles: [
    "CNAME",
    "LICENSE",
    "README.md",
    "data/**/*",
    "favicon.ico",
    "favicon.svg",
    "favicon-*.png",
    "apple-touch-icon*.png",
    "android-chrome-*.png",
    "site.webmanifest",
    "browserconfig.xml",
    "mstile-*.png",
  ],
  excludePatterns: [
    "node_modules/**",
    "dist/**",
    ".git/**",
    ".vscode/**",
    "*.min.css",
    "*.min.js",
    "*.map",
    "css/bootstrap*.css", // Exclude Bootstrap CSS files
  ],
};

// HTML minification options
const htmlMinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
  minifyURLs: true,
  removeEmptyAttributes: true,
  removeOptionalTags: true,
  removeTagWhitespace: true,
  sortAttributes: true,
  sortClassName: true,
};

// CSS minification options
const cssMinifyOptions = {
  level: 2,
  format: "keep-breaks",
  inline: ["none"],
  rebase: false,
};

// JavaScript minification options
const jsMinifyOptions = {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ["console.log", "console.info", "console.debug"],
  },
  mangle: true,
  format: {
    comments: false,
  },
};

function preprocessHtmlContent(filePath, htmlContent) {
  try {
    const fileName = path.basename(filePath);
    if (fileName !== "engineering_responsibilities.html") {
      return htmlContent;
    }

    const companyDetailsPath = path.join(
      process.cwd(),
      "data",
      "company_details.json"
    );
    const csvPath = path.join(
      process.cwd(),
      "data",
      "engineering_responsibilities_compact.csv"
    );

    let embeddedCompanyDetails = null;
    let embeddedCsv = null;

    try {
      embeddedCompanyDetails = fs.readFileSync(companyDetailsPath, "utf8");
    } catch (_) {}
    try {
      embeddedCsv = fs.readFileSync(csvPath, "utf8");
    } catch (_) {}

    if (!embeddedCompanyDetails && !embeddedCsv) {
      return htmlContent;
    }

    // Convert CSV to JSON rows as well
    const toRows = (csvText) => {
      if (!csvText) return [];
      const lines = csvText.replace(/\r/g, "\n").split(/\n+/).filter(Boolean);
      if (lines.length === 0) return [];
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (!cols[0]) continue;
        const row = {};
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j];
          const raw = (cols[j] ?? "").trim();
          const asNum = raw === "" ? raw : Number(raw);
          row[key] = Number.isFinite(asNum) ? asNum : raw;
        }
        rows.push(row);
      }
      return rows;
    };

    const rowsJson = embeddedCsv ? JSON.stringify(toRows(embeddedCsv)) : "[]";

    // Inject raw data as non-executable script tags for safe minification
    const parts = [];
    if (embeddedCompanyDetails) {
      parts.push(
        `<script type="application/json" id="company-details-json">${embeddedCompanyDetails}</script>`
      );
    }
    parts.push(
      `<script type="application/json" id="company-rows-json">${rowsJson}</script>`
    );
    const injection = parts.join("\n");

    // Inject before </head> if present, otherwise prepend to content
    if (htmlContent.includes("</head>")) {
      return htmlContent.replace("</head>", `${injection}\n</head>`);
    }
    return injection + htmlContent;
  } catch (_) {
    return htmlContent;
  }
}

class WebsiteBuilder {
  constructor() {
    this.isWatchMode = process.argv.includes("--watch");
    this.isDevMode = process.argv.includes("--dev");
  }

  async build() {
    console.log("🚀 Starting build process...");

    try {
      // Clean output directory
      await this.cleanOutput();

      // Create output directory
      await fs.ensureDir(config.outputDir);

      // Process files
      await this.processHtmlFiles();
      await this.processCssFiles();
      await this.processJsFiles();
      await this.bundleChartModule();
      await this.copyImages();
      await this.copyStaticFiles();

      // Show build statistics
      await this.showBuildStatistics();

      console.log("✅ Build completed successfully!");

      if (this.isWatchMode) {
        this.startWatchMode();
      }
    } catch (error) {
      console.error("❌ Build failed:", error.message);
      process.exit(1);
    }
  }

  async cleanOutput() {
    console.log("🧹 Cleaning output directory...");

    // More robust cleaning - retry if permission denied
    let retries = 3;
    while (retries > 0) {
      try {
        await fs.remove(config.outputDir);
        break;
      } catch (error) {
        if (error.code === "EPERM" && retries > 1) {
          console.log(
            `   Retrying clean operation... (${retries - 1} attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries--;
          continue;
        }
        throw error;
      }
    }
  }

  async robustCopy(sourcePath, outputPath, fileName) {
    let retries = 3;
    while (retries > 0) {
      try {
        await fs.ensureDir(path.dirname(outputPath));
        await fs.copy(sourcePath, outputPath);
        break;
      } catch (error) {
        if ((error.code === "EBUSY" || error.code === "EPERM") && retries > 1) {
          console.log(
            `   Retrying copy of ${fileName}... (${retries - 1} attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 150));
          retries--;
          continue;
        }
        throw error;
      }
    }
  }

  async processHtmlFiles() {
    console.log("📄 Processing HTML files...");

    const htmlFiles = await this.getFiles(config.htmlFiles);

    for (const file of htmlFiles) {
      if (this.shouldExclude(file)) continue;

      const sourcePath = path.join(config.sourceDir, file);
      let content = await fs.readFile(sourcePath, "utf8");
      // Preprocess to embed data for specific pages
      content = preprocessHtmlContent(sourcePath, content);
      const minified = HtmlMinifier.minify(content, htmlMinifyOptions);

      const outputPath = path.join(config.outputDir, file);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, minified);

      console.log(`  ✓ Minified: ${file}`);
    }
  }

  async processCssFiles() {
    console.log("🎨 Processing CSS files...");

    const cssFiles = await this.getFiles(config.cssFiles);

    for (const file of cssFiles) {
      if (this.shouldExclude(file)) continue;

      const sourcePath = path.join(config.sourceDir, file);
      const content = await fs.readFile(sourcePath, "utf8");

      // First purge unused CSS
      const purgedResult = await new PurgeCSS().purge({
        content: [
          path.join(config.sourceDir, "*.html"),
          path.join(config.sourceDir, "js/**/*.js"),
        ],
        css: [sourcePath],
        defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
        safelist: [
          // Keep Bootstrap classes that might be dynamically added
          /^btn-/,
          /^col-/,
          /^row/,
          /^container/,
          /^navbar/,
          /^nav-/,
          /^dropdown/,
          /^modal/,
          /^fade/,
          /^show/,
          /^active/,
          /^disabled/,
          /^hidden/,
          /^visible/,
          // Keep CSS custom properties
          /^--/,
          // Keep media queries
          /^@media/,
          /^@keyframes/,
          /^@import/,
        ],
      });

      const purgedCSS = purgedResult[0]?.css || content;

      // Then minify the purged CSS
      const minified = new CleanCSS(cssMinifyOptions).minify(purgedCSS).styles;

      const outputPath = path.join(config.outputDir, file);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, minified);

      console.log(`  ✓ Purged and minified: ${file}`);
    }
  }

  async processJsFiles() {
    console.log("⚡ Processing JavaScript files...");

    const jsFiles = await this.getFiles(config.jsFiles);

    for (const file of jsFiles) {
      if (this.shouldExclude(file) || config.excludeJsFiles.includes(file))
        continue;

      const sourcePath = path.join(config.sourceDir, file);
      const content = await fs.readFile(sourcePath, "utf8");

      try {
        const result = await minify(content, jsMinifyOptions);
        const minified = result.code;

        const outputPath = path.join(config.outputDir, file);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, minified);

        console.log(`  ✓ Minified: ${file}`);
      } catch (error) {
        console.warn(`  ⚠️  Could not minify ${file}: ${error.message}`);
        // Copy original file if minification fails
        const outputPath = path.join(config.outputDir, file);
        await this.robustCopy(sourcePath, outputPath, file);
      }
    }
  }

  async bundleChartModule() {
    // Only for engineering_responsibilities page: build a minimal Chart.js bundle
    try {
      const entrySource = `
        import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler } from 'chart.js';
        Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);
        // Expose Chart globally for existing page code
        if (typeof window !== 'undefined') {
          window.Chart = Chart;
        }
      `;
      const tmpEntry = path.join(
        process.cwd(),
        "node_modules",
        ".cache-chart-entry.mjs"
      );
      await fs.ensureDir(path.dirname(tmpEntry));
      await fs.writeFile(tmpEntry, entrySource);

      const outFile = path.join(config.outputDir, "vendor", "chart.min.js");
      await fs.ensureDir(path.dirname(outFile));

      await esbuild.build({
        entryPoints: [tmpEntry],
        bundle: true,
        minify: true,
        format: "iife",
        platform: "browser",
        target: ["es2018"],
        outfile: outFile,
        define: { "process.env.NODE_ENV": '"production"' },
        logLevel: "silent",
      });

      // Cleanup temp
      await fs.remove(tmpEntry);
      console.log("  ✓ Built minimal Chart.js bundle");
    } catch (err) {
      console.warn(
        "  ⚠️  Could not build minimal Chart.js bundle:",
        err.message
      );
    }
  }

  async copyImages() {
    console.log("🖼️  Copying images...");

    const imageFiles = await this.getFiles(config.imageFiles);

    for (const file of imageFiles) {
      if (this.shouldExclude(file)) continue;

      const sourcePath = path.join(config.sourceDir, file);
      const outputPath = path.join(config.outputDir, file);
      await this.robustCopy(sourcePath, outputPath, file);

      console.log(`  ✓ Copied: ${file}`);
    }
  }

  async copyStaticFiles() {
    console.log("📋 Copying static files...");

    for (const pattern of config.copyFiles) {
      const files = await this.getFiles([pattern]);

      for (const file of files) {
        if (this.shouldExclude(file)) continue;

        const sourcePath = path.join(config.sourceDir, file);
        const outputPath = path.join(config.outputDir, file);
        await this.robustCopy(sourcePath, outputPath, file);

        console.log(`  ✓ Copied: ${file}`);
      }
    }
  }

  async showBuildStatistics() {
    console.log("📊 Build Statistics:");

    try {
      // Calculate original size (excluding build artifacts)
      const originalFiles = await this.getAllSourceFiles();
      const originalSize = originalFiles.reduce((total, file) => {
        const stats = fs.statSync(path.join(config.sourceDir, file));
        return total + stats.size;
      }, 0);

      // Calculate build size
      const buildFiles = await this.getAllBuildFiles();
      const buildSize = buildFiles.reduce((total, file) => {
        const stats = fs.statSync(path.join(config.outputDir, file));
        return total + stats.size;
      }, 0);

      // Calculate vendor bytes shipped (files under dist/vendor/**)
      const vendorFiles = buildFiles.filter((file) =>
        file.replace(/\\/g, "/").startsWith("vendor/")
      );
      const vendorSize = vendorFiles.reduce((total, file) => {
        const stats = fs.statSync(path.join(config.outputDir, file));
        return total + stats.size;
      }, 0);

      const effectiveBuild = Math.max(buildSize - vendorSize, 0);
      const compressionRatio = (
        (1 - effectiveBuild / originalSize) *
        100
      ).toFixed(2);
      const originalSizeKB = (originalSize / 1024).toFixed(2);
      const buildSizeKB = (buildSize / 1024).toFixed(2);
      const effectiveBuildKB = (effectiveBuild / 1024).toFixed(2);

      console.log(`  Original size: ${originalSizeKB} KB`);
      console.log(`  Build size: ${buildSizeKB} KB`);
      console.log(`  Build size (excluding vendor): ${effectiveBuildKB} KB`);
      console.log(
        `  Vendor bytes shipped: ${(vendorSize / 1024).toFixed(2)} KB`
      );
      console.log(`  Compression (excluding vendor): ${compressionRatio}%`);
      console.log(`  Files processed: ${buildFiles.length}`);
    } catch (error) {
      console.warn(
        "  ⚠️  Could not calculate build statistics:",
        error.message
      );
    }
  }

  async getAllSourceFiles() {
    const allFiles = [];
    const patterns = [
      ...config.htmlFiles,
      ...config.cssFiles,
      ...config.jsFiles,
      ...config.imageFiles,
      ...config.copyFiles,
    ];

    for (const pattern of patterns) {
      const files = await this.getFiles([pattern]);
      allFiles.push(...files);
    }

    return allFiles.filter((file) => !this.shouldExclude(file));
  }

  async getAllBuildFiles() {
    const buildFiles = [];
    const buildDir = config.outputDir;

    if (await fs.pathExists(buildDir)) {
      const files = await fs.readdir(buildDir, { recursive: true });
      for (const file of files) {
        if (typeof file === "string" && !file.includes("node_modules")) {
          const filePath = path.join(buildDir, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            buildFiles.push(file);
          }
        }
      }
    }

    return buildFiles;
  }

  async getFiles(patterns) {
    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: config.sourceDir,
        ignore: config.excludePatterns,
      });
      files.push(...matches);
    }
    return files;
  }

  shouldExclude(file) {
    return config.excludePatterns.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
      );
      return regex.test(file);
    });
  }

  startWatchMode() {
    console.log("👀 Starting watch mode...");
    console.log("   Watching for changes to HTML, CSS, JS, and image files...");
    console.log("   Press Ctrl+C to stop watching.");

    // Only watch specific file types to avoid noise
    const watchPatterns = ["*.html", "css/**/*.css", "js/**/*.js", "img/**/*"];

    const watcher = chokidar.watch(watchPatterns, {
      ignored: [
        "node_modules/**",
        "dist/**",
        ".git/**",
        ".vscode/**",
        "**/*.min.*",
        "**/*.map",
      ],
      persistent: true,
      ignoreInitial: true, // Don't trigger on existing files
    });

    let buildTimeout;
    let buildPromise = null;
    let pendingChanges = new Set();

    const debouncedBuild = async (eventType, filePath) => {
      // Add to pending changes
      pendingChanges.add(filePath);

      // Clear any pending timeout
      clearTimeout(buildTimeout);

      // If already building, just wait and queue another build
      if (buildPromise) {
        console.log(`📝 Queued: ${filePath}`);
        buildTimeout = setTimeout(
          () => debouncedBuild(eventType, filePath),
          500
        );
        return;
      }

      buildTimeout = setTimeout(async () => {
        // Skip if another build started
        if (buildPromise) return;

        console.log(`🔄 Processing ${pendingChanges.size} file change(s)...`);
        pendingChanges.clear();

        buildPromise = (async () => {
          try {
            await this.build();
            console.log("   👀 Watching for more changes...");
          } catch (error) {
            console.error("❌ Build failed:", error.message);
            console.log("   👀 Continuing to watch for changes...");
          }
        })();

        await buildPromise;
        buildPromise = null;
      }, 600); // Longer delay to prevent rapid rebuilds
    };

    watcher.on("change", (filePath) => debouncedBuild("🔄", filePath));

    watcher.on("add", (filePath) => debouncedBuild("➕", filePath));
    watcher.on("unlink", (filePath) => debouncedBuild("➖", filePath));
  }
}

// Run the build
const builder = new WebsiteBuilder();
builder.build().catch(console.error);
