# Veltrix design system (v2)

*An analytics terminal that tells you when there is no edge.* The design serves that sentence: the
data is dense and legible, and the honest numbers sit on screen, not behind a link.

Patterns drawn from Bloomberg's colour-vision work (never colour alone), Linear and Koyfin (keyboard
first, shortcuts shown where they are used), Hyperliquid (fixed regions) and TradingView (chart
conventions). The rules below are what the code enforces.

## Tokens (`app/globals.css`)

| Token | Value | Use | Contrast on `--background` |
|---|---|---|---|
| `--background` | `#0A0C0F` | page | – |
| `--card` | `#111418` | panel | – |
| `--elevated` | `#171B21` | inputs, nested rows, hover | – |
| `--overlay` | `#1D222A` | palette, menus | – |
| `--border` / `--border-strong` | `#232933` / `#2E3540` | hairlines | – |
| `--foreground` | `#E8EBEF` | primary text | 16.4:1 |
| `--secondary-foreground` | `#A3ABB6` | secondary text | 8.5:1 |
| `--muted-foreground` | `#7D8691` | labels, captions | 5.3:1 (4.7:1 on `--elevated`) |
| `--primary` | `#C6F24E` | focus ring, primary action, active nav | 15.1:1 |
| `--success` | `#3DD68C` | up | 10.4:1 |
| `--destructive` | `#FF6B6B` | down | 7.1:1 |
| `--warning` | `#F5B83D` | "no edge", caution | 11.0:1 |

Up and down differ in lightness as well as hue, and are **never the only cue**: every change
carries ▲/▼ and a sign.

## Type and spacing

- Inter for UI, JetBrains Mono for chart axes. `font-variant-numeric: tabular-nums` on every figure.
- Scale (px): 10 / 11 / 12 / **13 (body)** / 15 / 18 / 22–28 (`figure-lg`) / 28–36 (`figure-xl`).
- 4 px grid. Panel padding is 14 px. Gaps are 12 px between panels and 1 px hairlines inside them.
- Radius: 4 px (chips, segmented items), 6 px (buttons, inputs), 10 px (panels), 12 px (dialogs).

## Components

| Class / component | What |
|---|---|
| `Panel` (`components/ui/primitives.tsx`) | Panel with a 40 px header row (`panel-head`): title, optional glossary tip, actions |
| `.seg` | Segmented control. State comes from `aria-pressed`, so styling and accessibility can't drift |
| `.chip-up/-down/-flat/-warn/-accent` | 11 px status chips |
| `Delta` | Signed change with ▲/▼ |
| `Skeleton` (`.skeleton`) | Shimmer placeholder, sized like the content it replaces |
| `ErrorState`, `EmptyState` | Say what failed or is missing, offer a retry or a next step, never invent data |
| `.vote-track` / `.vote-fill` | Diverging bar for indicator votes (left bearish, right bullish, length = weight) |
| `kbd` | Keyboard hint |
| `EdgeReport`, `EdgeBadge` | The measured offline results (from `lib/evaluation.ts`) |
| `CommandPalette`, `ShortcutsSheet` | ⌘K palette and `?` sheet |

## Layout

- ≥ 1280 px: 200 px rail with labels and shortcut hints, a 44 px status bar (live ticker, last
  update, edge badge, search).
- 1024–1279 px: 56 px icon rail. The dashboard keeps two columns.
- < 1024 px: no rail. A bottom tab bar with five destinations; the rest are in the palette.
- Panels never cause horizontal page scroll. Wide tables and symbol strips scroll inside their own
  container.

## Motion

120 ms for hover and press, 180 ms for dialogs, 240 ms for route entrance. All of it is
transform-only (an opacity entrance can leave content invisible if it never runs), and it is
disabled under `prefers-reduced-motion`.

## Keyboard

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K`, `/` | Command palette |
| `?` | Shortcut sheet |
| `g` + `d t m i c p s` | Dashboard, Trade, Markets, Intelligence, Macro (c), Portfolio, Settings |
| `↑ ↓ ↵ esc` | Move, open, close inside dialogs |

Single-key shortcuts are ignored while focus is in an input, textarea, select or editable region.
