module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3001/dist/index.html",
        "http://localhost:3001/dist/engineering_responsibilities.html",
        "http://localhost:3001/dist/speaker-bio.html",
      ],
      startServerCommand: "npx http-server dist -p 3001",
      startServerReadyPattern: "Available on:",
      startServerReadyTimeout: 10000,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
