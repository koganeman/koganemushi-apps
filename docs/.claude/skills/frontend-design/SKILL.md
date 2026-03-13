---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## TailwindCSS Integration

When using TailwindCSS, leverage its full potential while maintaining design distinctiveness:

### Custom Configuration
- **tailwind.config.js**: Define project-specific design tokens
  - Custom color palettes with semantic naming (e.g., `primary`, `accent`, `surface`)
  - Extended spacing scales for precise control
  - Custom font families that align with the aesthetic vision
  - Screen breakpoints tailored to the application's needs

### CSS Variables Hybrid Approach
Combine Tailwind utilities with CSS custom properties for dynamic theming:
```css
:root {
  --color-brand: 220 90% 56%;
  --shadow-elevation: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```
Use in Tailwind: `bg-[hsl(var(--color-brand))]` or extend in config.

### Animation Strategy
- **Simple transitions**: Use Tailwind's `transition-*`, `duration-*`, `ease-*` utilities
- **Complex orchestration**: Integrate **framer-motion** for React projects
  - Page transitions with `AnimatePresence`
  - Staggered list animations with `variants`
  - Scroll-triggered reveals with `useInView`
  - Gesture-based interactions with `drag`, `whileHover`, `whileTap`

### Custom Class Guidelines
- Use `@apply` sparingly—only for truly reusable patterns
- Prefer component composition over utility extraction
- When creating custom classes, ensure they follow the project's naming convention

## Japanese Typography

Avoid generic Japanese fonts that create an "AI-generated" impression. Choose typefaces with personality:

### Display/Heading Fonts (見出し用)
- **Shippori Mincho** (しっぽり明朝): Elegant serif with traditional character, excellent for formal/sophisticated contexts
- **M PLUS 1p**: Geometric sans with personality, works for modern/tech aesthetics
- **Zen Kaku Gothic New**: Clean but distinctive gothic, good balance of readability and character
- **Kaisei Decol**: Decorative with retro charm, suitable for creative/playful designs
- **Dela Gothic One**: Bold impact font for strong headlines

### Body Text Fonts (本文用)
- **BIZ UDPGothic**: Optimized for business documents, exceptional readability at small sizes
- **Klee One**: Pen-like warmth, creates approachable/friendly impression
- **Zen Maru Gothic**: Rounded gothic with soft personality
- **Murecho**: Variable weight font with modern proportions

### Fonts to AVOID
- **Noto Sans JP**: Ubiquitous, lacks distinctiveness, immediately reads as "default"
- **Meiryo**: System font, generic corporate feel
- **Yu Gothic**: Overused, bland

### Font Pairing Examples
| Context | Heading | Body |
|---------|---------|------|
| Luxury/Editorial | Shippori Mincho | BIZ UDPGothic |
| Modern Tech | M PLUS 1p | Zen Kaku Gothic New |
| Friendly/Approachable | Kaisei Decol | Klee One |
| Bold/Impactful | Dela Gothic One | Murecho |

### Implementation
```css
@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=BIZ+UDPGothic:wght@400;700&display=swap');
```

## Business Application UI Patterns

For 業務システム (business/enterprise applications), balance information density with usability:

### Data Density Philosophy
- **Purposeful density**: Pack information efficiently without overwhelming
- **Scannable hierarchy**: Use typography weight/size to guide the eye
- **Breathing room**: Strategic whitespace between logical groups, not everywhere
- **Responsive density**: Denser on desktop, more spacious on mobile

### Table Design (テーブル)
Go beyond basic tables with functional enhancements:
- **Striped rows**: Subtle alternating backgrounds (`bg-slate-50/50` on odd rows)
- **Hover states**: Row highlight on hover for tracking
- **Sticky headers**: `position: sticky` for long scrollable tables
- **Column alignment**: Right-align numbers, left-align text
- **Compact mode**: Smaller padding option for data-heavy views
- **Sortable indicators**: Visual cues for sort state
- **Selection states**: Checkbox column with bulk actions

### Status Badges (ステータスバッジ)
Semantic colors with distinctive interpretations:

| Status | Traditional | Creative Alternative |
|--------|------------|---------------------|
| Success/完了 | Green | Teal, mint, sage |
| Warning/注意 | Yellow/Amber | Gold, marigold, peach |
| Error/エラー | Red | Crimson, coral, rust |
| Info/情報 | Blue | Indigo, cyan, sky |
| Pending/保留 | Gray | Slate, stone, cool gray |
| New/新規 | Purple | Violet, fuchsia, magenta |

Badge styling options:
- **Pill badges**: Rounded full with background
- **Outlined badges**: Border only with subtle fill
- **Dot indicators**: Small circle prefix with text
- **Tag style**: Slightly rounded corners, more rectangular

### Cards & Panels (カード・パネル)
Create visual hierarchy through varied treatments:

**Shadow variations**:
- Subtle lift: `shadow-sm` for inline cards
- Floating: `shadow-lg` for modals/popovers
- Dramatic: Custom large shadow for hero elements

**Border treatments**:
- Hairline: `border border-gray-200`
- Accent edge: `border-l-4 border-l-blue-500`
- Divided sections: Internal `divide-y`

**Background strategies**:
- Solid surface: Slightly off-white (`bg-gray-50`)
- Frosted glass: `backdrop-blur-sm bg-white/80`
- Gradient subtle: Light directional gradient

### Dashboard Patterns
- **KPI Cards**: Large number, trend indicator, sparkline
- **Action panels**: Primary action prominent, secondary grouped
- **Filter bars**: Horizontal with dropdown/chip selectors
- **Sidebar navigation**: Collapsible with icon-only mode
- **Notification areas**: Toast positioning, badge counts

### Form Patterns for Business Apps
- **Inline validation**: Real-time feedback with clear error states
- **Required field indicators**: Consistent marking (asterisk or label)
- **Field grouping**: Logical sections with clear boundaries
- **Keyboard navigation**: Tab order, enter to submit
- **Auto-save indicators**: Status for draft/saved states
折りたたむ




10:49