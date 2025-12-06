# George Holt's Personal Website

This is my personal website showcasing my professional experience and engineering management insights.

## Pages

- **Home Page** (`index.html`) - Main professional profile and testimonials
- **Engineering Responsibilities** (`engineering_responsibilities.html`) - Interactive radar chart comparing engineering management approaches across companies

## Development Setup

### Prerequisites

- **Node.js** (installed via nvm recommended)
- **npm** (comes with Node.js)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development Workflow

#### Build the Website

```bash
npm run build
```

#### Watch Mode (Auto-rebuild on changes)

```bash
npm run build:watch
```

#### Launch in Browser

1. Build the project first: `npm run build`
2. Open `dist/index.html` or `dist/engineering_responsibilities.html` in your browser

#### Run Performance Tests

```bash
npm test
```

This provides instructions for manual Lighthouse testing:

- **Performance** (target: 90%+)
- **Accessibility** (target: 90%+)
- **Best Practices** (target: 90%+)
- **SEO** (target: 90%+)

**Note:** Automated testing has issues on Windows, so manual testing is recommended.

### VS Code Launch Configuration (Optional)

1. Open the project in VS Code
2. Press `F5` or go to Run and Debug (Ctrl+Shift+D)
3. Select one of the following launch configurations:
   - **"Open index.html (Optimized)"** - Opens the built main page
   - **"Open engineering_responsibilities.html (Optimized)"** - Opens the built radar chart page
   - **"Profile index.html"** - Opens with browser dev tools for profiling
   - **"Profile engineering_responsibilities.html"** - Opens with browser dev tools for profiling

## File Structure

```
george-holt.github.io/
├── index.html                          # Main homepage (source)
├── engineering_responsibilities.html    # Radar chart page (source)
├── css_variables.html                  # CSS variable reference
├── data/
│   ├── engineering_responsibilities_compact.csv  # Chart data
│   └── company_details.json            # Company information
├── img/
│   └── George Holt Small.webp          # Profile image
├── js/                                 # JavaScript libraries
├── dist/                               # Built/minified files (generated)
├── .vscode/
│   └── launch.json                     # VS Code launch configurations
├── .github/
│   └── workflows/
│       └── deploy.yml                  # GitHub Actions deployment
├── package.json                        # Node.js dependencies and scripts
├── build.js                           # Custom build script
└── README.md
```

## Build Process

The website uses a custom Node.js build process that:

- **Minifies HTML, CSS, and JavaScript** for optimal performance
- **Optimizes images** (converts to WebP format)
- **Removes unused CSS** using PurgeCSS
- **Generates build statistics** showing compression ratios
- **Watches for changes** and auto-rebuilds during development

### Build Output

- **Original size**: ~87KB
- **Build size**: ~56KB
- **Compression**: ~36% reduction

## Technologies Used

- **HTML5** - Structure
- **CSS3** - Custom responsive design (no external frameworks)
- **JavaScript (ES6+)** - Interactive functionality
- **Chart.js** - Interactive radar charts
- **PapaParse** - CSV data parsing
- **Node.js** - Build automation
- **GitHub Pages** - Hosting
- **GitHub Actions** - Automated deployment

## Deployment

The website is automatically deployed to GitHub Pages via GitHub Actions:

1. Push changes to the `main` branch
2. GitHub Actions runs the build process
3. Built files are deployed to `https://george-holt.github.io`

## Performance Optimizations

- **Minified assets** for faster loading
- **WebP images** for smaller file sizes
- **System fonts** to eliminate external font loading
- **Inline critical CSS** to prevent render blocking
- **Removed unused libraries** (jQuery, Bootstrap, IE polyfills)
- **PurgeCSS** to eliminate unused CSS rules

## Testing

The website includes automated Lighthouse testing to ensure quality:

### Running Tests

```bash
npm test                    # Run full Lighthouse tests
npm run test:lighthouse     # Same as npm test
npm run test:ci            # Run Lighthouse CI (for CI/CD)
```

### Test Coverage

- **Performance** - Core Web Vitals, loading speed
- **Accessibility** - WCAG compliance, screen reader support
- **Best Practices** - Security, modern web standards
- **SEO** - Search engine optimization

### Test Targets

- Performance: 90%+
- Accessibility: 90%+
- Best Practices: 90%+
- SEO: 90%+

## Development Notes

- The site uses CSS custom properties (variables) for consistent theming
- All styles are inlined in HTML files for optimal performance
- Mobile-first responsive design with custom breakpoints
- No external CSS or JavaScript dependencies in production
