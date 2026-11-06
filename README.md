# Sleeve Studio

A browser design tool for printed arm sleeves. Plain HTML, CSS and JavaScript, with nothing to install or build.

Live site: https://ashmitkb.github.io/sleeve-studio/

## Pages

- `index.html`: home page
- `looks.html`: gallery of ready-made designs
- `studio.html`: the design tool
- `guide.html`: how to use it and how to get a sleeve printed

## What it does

- 16 ready-made looks and 22 stackable presets
- Pen painting with pressure: ink, marker, dry brush, spray
- Flat template, flat-lay pair and turnable on-arm views
- Print check for thin lines, the elbow zone and seams
- Exports: print SVG, 300 dpi PNG, flat-lay and on-arm images

Designs save in your own browser. The template is 46 cm long, 17 cm at the top and 11 cm at the wrist; use your printer's template for the final run.

## Code

- `assets/engine.js`: template geometry, presets, looks and artwork drawing, shared by every page
- `assets/studio.js`: the Studio interface, on-arm view, painting and exports
- `assets/site.js`: Home and Looks pages
- `assets/icons.js`: icons from [Lucide](https://lucide.dev) (ISC licence)
