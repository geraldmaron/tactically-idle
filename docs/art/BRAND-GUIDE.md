# Tactically Idle brand kit

## Concept
An original **TI command mark** combines the title initials, the two upright strokes of an idle/pause signal, and open planning corners. The mark belongs to a fictional management game. It deliberately avoids real police or military agency insignia.

## Main assets
- `public/brand/header-lockup-dark.svg`: transparent header lockup for dark UI; preferred at 120–146 px wide, with accessible text supplied by the host page
- `header-lockup-light.svg`: matching light-surface lockup
- `wordmark-dark.svg`, `wordmark-light.svg`: single-line title
- `stacked-lockup-*.svg`: centered title/menu format
- `mark-*.svg`: stand-alone mark, including one-color white/dark variants
- `icon.svg`: square app-icon source; rounded navy container is part of the artwork
- `icon-maskable.svg`: full-bleed square with the mark inside the central safe region for future maskable use
- `favicon.svg`, `favicon.ico`: current web browser assets
- `icon-{16,32,48,64,128,192,256,512,1024}.png`, `apple-touch-icon.png` (180): verified pixel-size exports
- `social-card.svg/png`: 1200×630 share composition
- `title-screen.svg/png`: 1200×800 title/menu artwork
- `splash-mobile.svg/png`: 390×844 mobile startup treatment
- `loading-mark.svg`: static reusable loading mark; loading state and text belong in HTML
- `brand-preview.svg/png`: review board

These are source assets and reusable exports. Their presence does not mean that a native app, PWA installation flow, or additional game menu has been implemented.

## Color
- Night navy `#0e1624`: brand surface, matches existing UI
- Chalk `#f3f7ff`: primary ink on navy
- Signal amber `#f3b432`: framing, attention and active accents
- Blueprint blue `#1f55b8`: plans and optional supporting surfaces
- Muted slate `#aab7ca`: supporting copy on dark surfaces
- Light-surface amber `#a96a00`: darker mark accent on white

Do not use amber alone for long text on white. Preserve existing semantic green, amber and red UI states independently from the brand. Never infer an officer's skills or status from portrait appearance.

## Typography
The supplied logo lettering is outlined DejaVu Sans Condensed Bold, so SVG rendering has no font-network dependency. The related font license is included in `FONT-LICENSE.txt`. The product's existing Oswald / Barlow / Barlow Condensed UI fonts remain appropriate; reserve Kalam for plan annotations. Keep logo letterforms intact rather than retyping the name in a different font.

## Spacing and use
Keep at least one vertical stroke's width around the stand-alone mark and half the mark's cap height around lockups. Preserve aspect ratio; use `object-fit: contain` for brand assets. Minimum practical icon size is 16 px; use the mark rather than the full name at that size. The header is designed for the app's 52 px bar and the 320–430 px mobile layout. Do not add glows, extra shields, a weapon, an official badge, gradients, or new outlines.

## Rebuild and origin
`python3 docs/art/build_brand.py` rebuilds the SVG sources and PNG/ICO exports using fontTools, Inkscape and ImageMagick. This is original code-native vector artwork. Raster portraits and gear are separate generated artwork, documented by their own prompt files and ready manifests. No third-party agency art has been copied.
