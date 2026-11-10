# UI Rendering Options

Options for how the chess board UI could be rendered, with the benefits and downsides of each. The current prototype (`src/app/index.html`) uses plain DOM + CSS Grid with Unicode pieces.

## Part 1: Board rendering approach

### 1. Plain DOM + CSS Grid (current prototype)

**Benefits**
- No dependencies and no build step; opens straight from a file.
- Easiest to learn and debug (browser dev tools show every square).
- Free accessibility basics: real elements, focusable, screen-reader labels via `aria-label`.
- Responsive layout is simple (`aspect-ratio`, `vmin`, grid).
- Click and hover handling is built in.

**Downsides**
- Hand-written DOM updates get messy as features grow (highlights, last move, check, promotion picker).
- Drag-and-drop and piece animations take extra work.
- Easy for UI state and engine state to drift apart if you update the DOM ad hoc.

### 2. SVG

**Benefits**
- Scales perfectly at any size or screen density.
- Pieces, arrows, and highlights are all vector shapes, so move arrows and coordinates are easy to draw.
- Still part of the DOM, so click events and CSS styling work.
- Good fit for custom piece sets.

**Downsides**
- More verbose markup; coordinate math is on you.
- Many SVG nodes can be slower than DOM on low-end devices (rarely a problem for 64 squares and 32 pieces).
- Text and accessibility need extra care.

### 3. HTML Canvas (2D)

**Benefits**
- Full control over drawing; smooth animations and drag effects.
- Constant performance no matter how many things are drawn.
- Easy to export a board image (for example, to share a position).

**Downsides**
- Nothing is a DOM element, so you write your own hit-testing (pixel to square).
- Poor accessibility by default; you must add a parallel text or ARIA layer.
- Must handle high-DPI scaling and redraws yourself.
- Harder to test than DOM output.

### 4. UI framework (React, Svelte, Vue, etc.)

**Benefits**
- Declarative: render the board straight from `GameState`, so UI and engine stay in sync.
- Components (`Board`, `Square`, `Piece`, `MoveList`) make the app easier to grow and split among teammates.
- Large ecosystem (state management, drag-and-drop libraries, routing for game pages).
- Fits well with the login and game-list screens that AT Protocol will need.

**Downsides**
- Adds a build step, dependencies, and a learning curve.
- Heavier than needed for a single board.
- Team must agree on one framework; mixed skill levels can slow things down.
- The AT Protocol OAuth browser client works with any of them, but you still have to wire it up.

### 5. Web Components (custom elements)

**Benefits**
- Standards-based and framework-free: a `<chess-board>` element could drop into any page.
- Encapsulated styles and behavior.
- Clean API: set a FEN attribute, listen for a `move` event.

**Downsides**
- More boilerplate than a framework, and less tooling and fewer community examples.
- Shadow DOM styling and form/state handling can be awkward.
- Fewer teammates will know it.

### 6. Server-rendered HTML (SSR / HTMX style)

**Benefits**
- Little client JS; works well on slow devices.
- Easy to share a static view of a game by URL.

**Downsides**
- Every move needs a server round trip, which fits poorly with a protocol where each player's data lives in their own repo.
- Needs a server to host and maintain.
- Interactions such as drag-and-drop feel slower.

### 7. WebGL / 3D (Three.js, etc.)

**Benefits**
- Eye-catching 3D boards and effects.

**Downsides**
- Large complexity jump for little gameplay value.
- Heavy on mobile; hard to make accessible.
- Likely out of scope for a course project.

## Part 2: How pieces are drawn

| Method | Benefits | Downsides |
|---|---|---|
| **Unicode glyphs** (current) | Zero assets, tiny, easy to start | Look differs per OS and font; some platforms render emoji-style pieces; limited styling |
| **Individual SVG files** | Crisp, themeable, consistent across platforms | Many files to load and manage; need a license check (for example, Lichess's cburnett set is open) |
| **SVG sprite sheet** | One request, easy to cache | Slightly harder to set up; recoloring needs care |
| **PNG images** | Simple to use, any art style | Blurry when scaled, larger files, no easy recoloring |
| **Canvas-drawn from a spritesheet** | Fast, good for animation | Only useful with the Canvas approach |

## Part 3: Cross-cutting concerns

- **Input:** click-to-move is simplest. Drag-and-drop feels better on desktop but needs pointer and touch handling, and a click fallback for accessibility.
- **Accessibility:** keyboard navigation, `aria-label`s like "white knight on g1", and a text move list. DOM and SVG make this much easier than Canvas.
- **Responsiveness:** the board must work on phones. DOM, CSS Grid, and SVG handle this best.
- **Testability:** the engine already uses Vitest. A framework or pure render function (`GameState` to markup) is easier to test than imperative DOM code.
- **AT Protocol fit:** the UI should only take a game state in and emit a move out. That keeps `src/atproto/` (login, reading and writing records, listening for the opponent's moves) separate from rendering, so any option above can be swapped in.

## Recommendation

For this project, start with **DOM + CSS Grid** (or SVG pieces on a DOM grid), kept behind a small `render(gameState)` function. Move to a framework such as Svelte or React only when login, game lists, and move history make the hand-written DOM updates hard to manage. Skip Canvas, WebGL, and SSR unless a specific requirement calls for them.
