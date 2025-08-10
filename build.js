#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const { glob } = require("glob");
const HtmlMinifier = require("html-minifier");
const CleanCSS = require("clean-css");
const { minify } = require("terser");
const { PurgeCSS } = require("purgecss");

const chokidar = require("chokidar");

// Configuration
const config = {
  sourceDir: ".",
  outputDir: "dist",
  htmlFiles: ["*.html"],
  cssFiles: ["css/**/*.css"],
  jsFiles: ["js/**/*.js"],
  excludeJsFiles: ["js/bootstrap.js", "js/bootstrap.min.js"], // Exclude Bootstrap JS
  imageFiles: ["img/**/*.webp"], // Only copy WebP images
  copyFiles: ["CNAME", "LICENSE", "README.md", "data/**/*"], // Removed fonts
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
      const content = await fs.readFile(sourcePath, "utf8");
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

      const compressionRatio = ((1 - buildSize / originalSize) * 100).toFixed(
        2
      );
      const originalSizeKB = (originalSize / 1024).toFixed(2);
      const buildSizeKB = (buildSize / 1024).toFixed(2);

      console.log(`  Original size: ${originalSizeKB} KB`);
      console.log(`  Build size: ${buildSizeKB} KB`);
      console.log(`  Compression: ${compressionRatio}%`);
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
