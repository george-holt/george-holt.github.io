# Website Build Process

This project uses a Node.js-based build system to minify and optimize all website assets for production deployment.

## Prerequisites

- Node.js (installed via nvm)
- npm (comes with Node.js)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

## Available Commands

### Build Commands

- **`npm run build`** - Build the website for production

  - Minifies HTML, CSS, and JavaScript
  - Copies images and static files
  - Shows compression statistics
  - Outputs to `dist/` directory

- **`npm run build:watch`** - Build and watch for changes

  - Automatically rebuilds when files change
  - Perfect for development

- **`npm run dev`** - Development build

  - Same as build but with development-friendly settings

- **`npm run clean`** - Clean the build output
  - Removes the `dist/` directory

## Build Output

The build process creates a `dist/` directory containing:

- **Minified HTML files** - All whitespace removed, comments stripped
- **Purged and minified CSS files** - Unused CSS removed, then optimized and compressed
- **Minified JavaScript files** - Compressed and mangled
- **Optimized images** - Compressed JPEG, PNG, and WebP formats
- **Static files** - CNAME, fonts, data files, etc.

## File Processing

### HTML Files

- Removes comments and whitespace
- Minifies inline CSS and JavaScript
- Optimizes attributes and tags
- Sorts attributes and class names

### CSS Files

- **Purges unused CSS** - Removes CSS classes and rules that aren't used in your HTML/JS
- Removes unnecessary whitespace and comments
- Combines selectors where possible
- Optimizes properties and values
- Level 2 optimization (aggressive)

### JavaScript Files

- Removes console.log statements (in production)
- Mangles variable names
- Compresses code structure
- Removes debugger statements

### Images

- Images are copied as-is (no optimization to avoid dependency issues)
- Consider using WebP format for better compression

## Configuration

The build process is configured in `build.js`. Key settings:

- **Source directory**: `.` (current directory)
- **Output directory**: `dist/`
- **Excluded patterns**: `node_modules/`, `dist/`, `.git/`, `*.min.*`, `*.map`

## Deployment

After building, the `dist/` directory contains your optimized website ready for deployment to GitHub Pages or any web server.

## Troubleshooting

### Common Issues

1. **JavaScript minification errors**

   - Check for syntax errors in your JS files
   - Original files are copied if minification fails

2. **Missing dependencies**
   - Run `npm install` to install all required packages

### Performance Tips

- Use WebP images when possible for better compression
- Keep original source files for development
- Use watch mode during development for automatic rebuilds
- The build process is designed to fail gracefully - if optimization fails, original files are used
