# George Holt's Personal Website

This is my personal website showcasing my professional experience and engineering management insights.

## Pages

- **Home Page** (`index.html`) - Main professional profile and testimonials
- **Engineering Responsibilities** (`engineering_responsibilities.html`) - Interactive radar chart comparing engineering management approaches across companies

## How to Launch the Website

### Option 1: VS Code Launch Configuration (Recommended)

1. Open the project in VS Code
2. Press `F5` or go to Run and Debug (Ctrl+Shift+D)
3. Select one of the following launch configurations:
   - **"Open index.html in Chrome"** - Opens the main page directly
   - **"Open engineering_responsibilities.html in Chrome"** - Opens the radar chart page directly
   - **"Launch with Live Server"** - If you have Live Server extension installed

### Option 2: Direct File Opening

Simply double-click on `index.html` or `engineering_responsibilities.html` to open them directly in your browser.

### Option 3: Live Server Extension (VS Code)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"
3. The website will open at `http://localhost:5500`

## File Structure

```
george-holt.github.io/
├── index.html                          # Main homepage
├── engineering_responsibilities.html    # Radar chart page
├── data/
│   └── engineering_responsibilities_compact.csv  # Chart data
├── css/                               # Bootstrap and custom styles
├── js/                                # JavaScript libraries
├── img/                               # Images
├── fonts/                             # Font files
└── .vscode/
    └── launch.json                    # VS Code launch configurations
```

## Technologies Used

- **HTML5** - Structure
- **Bootstrap 3** - Responsive design and components
- **Chart.js** - Interactive radar charts
- **PapaParse** - CSV data parsing
- **jQuery** - JavaScript utilities

## Development

The website is designed to be a simple static site that can be hosted on GitHub Pages. All assets are self-contained and the site works without any build process.