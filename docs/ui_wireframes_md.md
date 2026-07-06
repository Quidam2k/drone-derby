# UI Wireframes and Design Specifications

## Main Game Interface

### Desktop Layout (1920x1080)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏁 Robot Racer    Game: #RR-4521    Turn: 3/15    [⚙️Settings] [📱Share] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│     A  B  C  D  E  F  G  H  I  J          Player Status:               │
│   ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐        ┌─────────────────────────┐    │
│ 1 │  │  │■ │  │  │  │  │■ │  │  │        │ 🤖 Alice    ✅ Ready    │    │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        │ 🤖 Bob      ⏳ Thinking │    │
│ 2 │  │  │  │→ │→ │→ │  │  │  │  │        │ 🤖 Carol    ✅ Ready    │    │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        │ 🤖 You      ⏳ Programming│   │
│ 3 │  │① │  │  │🤖│  │  │  │② │  │        └─────────────────────────┘    │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤                                       │
│ 4 │  │  │  │  │  │  │  │  │  │  │        Stats:                         │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        • Hand: 9 cards                │
│ 5 │  │  │  │← │← │← │  │  │  │  │        • Energy: 3 ⚡                 │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        • Checkpoints: 1/3             │
│ 6 │  │  │  │  │  │  │  │  │  │  │        • Position: E3 →              │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤                                       │
│ 7 │⭐│  │  │  │  │  │  │  │⭐│  │        Last Turn Result:              │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        "Moved forward, hit conveyor"   │
│ 8 │  │  │■ │  │  │  │  │■ │  │  │                                       │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤        [📹 Replay Turn] [🔄 Refresh]   │
│ 9 │  │  │  │  │  │  │  │  │  │  │                                       │
│   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤                                       │
│10 │  │  │  │  │  │  │  │  │  │  │                                       │
│   └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘                                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Programming Registers:                                                  │
│ [1] [Move 2  ] [2] [Turn L ] [3] [Move 1 ] [4] [______] [5] [______]   │
│     Priority:      Priority:     Priority:                              │
│     780           245            650                                     │
│                                                                         │
│ Available Cards (drag to registers above):                             │
│ [Move 1][Move 3][Back Up][Turn R][U-Turn][Move 1][Turn L][Move 2][Turn R]│
│                                                                         │
│ Actions: [🚀 Submit Turn] [⚡ Power Down] [🗑️ Clear All] [💾 Save Draft] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card Programming Interface Detail
```
┌─────────────────────────────────────────────────────────────────┐
│ Programming Phase - Select 5 cards for this turn               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Registers (drop cards here):                                   │
│                                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │    1    │ │    2    │ │    3    │ │    4    │ │    5    │    │
│ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │    │
│ │ │MOVE │ │ │ │TURN │ │ │ │MOVE │ │ │ │ --- │ │ │ │ --- │ │    │
│ │ │  2  │ │ │ │  L  │ │ │ │  1  │ │ │ │     │ │ │ │     │ │    │
│ │ │ 780 │ │ │ │ 245 │ │ │ │ 650 │ │ │ │     │ │ │ │     │ │    │
│ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │    │
│ │  First  │ │ Second  │ │  Third  │ │ Fourth  │ │  Fifth  │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                                 │
│ Hand (9 cards - drag from here):                              │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│ │MOVE │ │MOVE │ │BACK │ │TURN │ │U-   │ │MOVE │ │TURN │      │
│ │  3  │ │  1  │ │ UP  │ │  R  │ │TURN │ │  1  │ │  L  │      │
│ │ 820 │ │ 540 │ │ 460 │ │ 380 │ │ 45  │ │ 495 │ │ 315 │      │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      │
│                                                               │
│ ┌─────┐ ┌─────┐                                              │
│ │MOVE │ │TURN │                                              │
│ │  2  │ │  R  │                                              │
│ │ 720 │ │ 420 │                                              │
│ └─────┘ └─────┘                                              │
│                                                               │
│ Timer: ⏱️ No time limit (async mode)                          │
│ [🚀 Submit Programming] [💾 Save Draft] [🔄 Reset]           │
└─────────────────────────────────────────────────────────────────┘
```

## Level Editor Interface

### Editor Layout (Full Screen)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎮 Board Editor    "Untitled Board"    [💾Save] [📁Load] [🧪Test] [📤Share]│
├──────────────┬──────────────────────────────────────┬──────────────────┤
│ Tile Palette │              10x10 Grid              │   Templates      │
│              │                                      │                  │
│ Tools:       │     A  B  C  D  E  F  G  H  I  J     │ 📁 My Templates  │
│ 🔘 Place     │   ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐   │                  │
│ ◯ Paint      │ 1 │  │  │  │  │  │  │  │  │  │  │   │ ┌────────────┐   │
│ ◯ Select     │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ │ ■  ■  ■ ■ │   │
│ ◯ Delete     │ 2 │  │  │  │  │  │  │  │  │  │  │   │ │ .  .  . . │   │
│              │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ │ .  ①  . . │   │
│ Tiles:       │ 3 │  │  │  │  │  │  │  │  │  │  │   │ │ ■  ■  ■ ■ │   │
│ 🔘 🔲 Floor  │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ └────────────┘   │
│ ◯ ⬛ Wall    │ 4 │  │  │  │  │  │  │  │  │  │  │   │ "Corner Room"    │
│ ◯ ➡️ Conv    │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ ⭐⭐⭐ (127 uses) │
│ ◯ ⏩ Fast    │ 5 │  │  │  │  │  │  │  │  │  │  │   │                  │
│ ◯ ①② Check  │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ ┌────────────┐   │
│ ◯ ⭐ Start   │ 6 │  │  │  │  │  │  │  │  │  │  │   │ │ → → → → → │   │
│              │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ │ ↑ . . . ↓ │   │
│ Properties:  │ 7 │  │  │  │  │  │  │  │  │  │  │   │ │ ↑ . ② . ↓ │   │
│ ┌──────────┐ │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ │ ↑ . . . ↓ │   │
│ │ Selected │ │ 8 │  │  │  │  │  │  │  │  │  │  │   │ │ ← ← ← ← ← │   │
│ │   None   │ │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ └────────────┘   │
│ │          │ │ 9 │  │  │  │  │  │  │  │  │  │  │   │ "Spiral Track"   │
│ │  [Edit]  │ │   ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤   │ ⭐⭐⭐⭐ (89 uses)│
│ └──────────┘ │10 │  │  │  │  │  │  │  │  │  │  │   │                  │
│              │   └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘   │ 📁 Community     │
│ Layers:      │                                      │ [🔍 Browse All]  │
│ ☑️ Grid      │                                      │                  │
│ ☑️ Coords    │                                      │ [📤 Upload]      │
│ ◯ Rulers     │                                      │ [⚡ Generate]    │
├──────────────┼──────────────────────────────────────┼──────────────────┤
│ Status: Ready    Selection: None    Zoom: 100%    Modified: No        │
│ [❌ New] [📂 Recent] [🔍 Find] [📋 Validate] [⚙️ Settings]            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Template Creation Dialog
```
┌─────────────────────────────────────┐
│ 💾 Save Selection as Template       │
├─────────────────────────────────────┤
│                                     │
│ Preview: ┌─────────────┐            │
│          │ ■ ■ → → ■ ■ │            │
│          │ . . . . . . │            │
│          │ . ① . . ② . │            │
│          │ ■ ■ ← ← ■ ■ │            │
│          └─────────────┘            │
│          Size: 6x4                  │
│                                     │
│ Name: [Checkpoint Bridge_____]      │
│                                     │
│ Description:                        │
│ ┌─────────────────────────────────┐ │
│ │Simple bridge with checkpoints  │ │
│ │between walls and conveyors     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Visibility: ◯ Private 🔘 Public    │
│                                     │
│ Tags: [bridge] [checkpoint] [+Add]  │
│                                     │
│ Category: [Obstacles ▼]             │
│                                     │
│        [💾 Save] [❌ Cancel]        │
└─────────────────────────────────────┘
```

## Mobile Responsive Design

### Phone Layout (Portrait 375x812)
```
┌─────────────────────────┐
│ 🏁 Robot Racer #RR-4521 │
│ Turn 3 • 👥 4/4 • ⏳     │
├─────────────────────────┤
│                         │
│   A B C D E F G H I J   │
│ 1 . . ■ . . . . ■ . .  │
│ 2 . . . → → → . . . .  │
│ 3 . ① . . 🤖 . . . ② .  │
│ 4 . . . . . . . . . .  │
│ 5 . . . ← ← ← . . . .  │
│ 6 ⭐ . . . . . . . ⭐ .  │
│ 7 . . ■ . . . . ■ . .  │
│                         │
├─────────────────────────┤
│ 📋 Programming:         │
│                         │
│ Registers:              │
│ [1][Move2] [2][TurnL]   │
│ [3][Move1] [4][____]    │
│ [5][____]               │
│                         │
│ ▼ Show Hand (9 cards)   │
├─────────────────────────┤
│ 👥 Players:             │
│ Alice✅ Bob⏳ Carol✅     │
│ You⏳                    │
│                         │
│ Energy: ⚡⚡⚡            │
│ Checkpoints: 1/3        │
│                         │
│ [🚀 Submit] [⚡ Power]   │
└─────────────────────────┘
```

### Tablet Layout (768x1024)
```
┌─────────────────────────────────────────────────────────────┐
│ 🏁 Robot Racer    Game #RR-4521    Turn 3/15    [⚙️][📱]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│      A  B  C  D  E  F  G  H  I  J      Player Status:      │
│    ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐    ┌──────────────────┐ │
│  1 │  │  │■ │  │  │  │  │■ │  │  │    │ 🤖 Alice    ✅   │ │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤    │ 🤖 Bob      ⏳   │ │
│  2 │  │  │  │→ │→ │→ │  │  │  │  │    │ 🤖 Carol    ✅   │ │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤    │ 🤖 You      ⏳   │ │
│  3 │  │① │  │  │🤖│  │  │  │② │  │    └──────────────────┘ │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤                         │
│  4 │  │  │  │  │  │  │  │  │  │  │    Stats:               │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤    • Energy: ⚡⚡⚡        │
│  5 │  │  │  │← │← │← │  │  │  │  │    • Checkpoints: 1/3   │
│    ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤    • Position: E3 →     │
│  6 │⭐│  │  │  │  │  │  │  │⭐│  │                         │
│    └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘    [📹 Replay]         │
│                                       [🔄 Refresh]        │
├─────────────────────────────────────────────────────────────┤
│ Programming: [1][Move2] [2][TurnL] [3][Move1] [4][___] [5][___] │
│                                                             │
│ Hand: [Move1][Move3][BackUp][TurnR][U-Turn][Move1][TurnL]   │
│                                                             │
│ [🚀 Submit Turn] [⚡ Power Down] [🗑️ Clear] [💾 Save]       │
└─────────────────────────────────────────────────────────────┘
```

## Color Scheme and Visual Design

### Color Palette
```css
/* Primary Brand Colors */
--primary-blue: #2563eb;     /* Main UI elements */
--primary-purple: #7c3aed;   /* Accent highlights */
--primary-dark: #1e293b;     /* Headers and text */

/* Status Colors */
--success-green: #059669;    /* Ready states, checkpoints */
--warning-orange: #d97706;   /* Warnings, timers */
--error-red: #dc2626;        /* Errors, damage */
--info-cyan: #0891b2;        /* Information, links */

/* Neutral Colors */
--gray-50: #f8fafc;          /* Light backgrounds */
--gray-100: #f1f5f9;         /* Cards, panels */
--gray-200: #e2e8f0;         /* Borders, dividers */
--gray-300: #cbd5e1;         /* Disabled states */
--gray-500: #64748b;         /* Secondary text */
--gray-700: #334155;         /* Primary text */
--gray-900: #0f172a;         /* Headers, emphasis */

/* Game Element Colors */
--floor-color: #f3f4f6;      /* Floor tiles */
--wall-color: #374151;       /* Wall tiles */
--conveyor-color: #3b82f6;   /* Normal conveyors */
--fast-conveyor: #1d4ed8;    /* Fast conveyors */
--checkpoint-color: #fbbf24; /* Checkpoints */
--start-color: #10b981;      /* Start positions */
--robot-1: #ef4444;          /* Player 1 robot */
--robot-2: #3b82f6;          /* Player 2 robot */
--robot-3: #10b981;          /* Player 3 robot */
--robot-4: #f59e0b;          /* Player 4 robot */
```

### Typography
```css
/* Font Stack */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px - small labels */
--text-sm: 0.875rem;   /* 14px - body text */
--text-base: 1rem;     /* 16px - default */
--text-lg: 1.125rem;   /* 18px - large text */
--text-xl: 1.25rem;    /* 20px - headings */
--text-2xl: 1.5rem;    /* 24px - page titles */
--text-3xl: 1.875rem;  /* 30px - hero text */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Component Styles

#### Card Components
```css
.game-card {
  background: linear-gradient(145deg, #ffffff, #f8fafc);
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.game-card:hover {
  border-color: var(--primary-blue);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.game-card.selected {
  border-color: var(--primary-blue);
  background: linear-gradient(145deg, #eff6ff, #dbeafe);
}
```

#### Button Styles
```css
.btn-primary {
  background: var(--primary-blue);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: var(--font-medium);
  transition: background 0.2s ease;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: transparent;
  color: var(--primary-blue);
  border: 2px solid var(--primary-blue);
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
}
```

## Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logical tab progression through interface
- **Focus Indicators**: Clear visual focus states
- **Shortcuts**: Keyboard shortcuts for common actions
- **Screen Reader**: ARIA labels and descriptions

### Visual Accessibility
- **Contrast**: WCAG AA compliant color combinations
- **Color Blind**: Icons and patterns supplement color
- **Font Size**: Scalable text with browser zoom
- **Motion**: Reduced motion options for sensitive users

### Interaction Accessibility
- **Touch Targets**: Minimum 44px tap areas on mobile
- **Error States**: Clear error messages and recovery
- **Loading States**: Progress indicators for async actions
- **Help Text**: Contextual help and tooltips

## Animation and Transitions

### Micro-Interactions
```css
/* Card hover effects */
.card-hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

/* Robot movement animation */
.robot-move {
  transition: transform 0.5s ease-in-out;
}

/* Turn execution sequence */
.register-execute {
  animation: highlight-pulse 0.3s ease-in-out;
}

@keyframes highlight-pulse {
  0% { background-color: var(--gray-100); }
  50% { background-color: var(--primary-blue); }
  100% { background-color: var(--gray-100); }
}
```

### Loading States
- **Game Loading**: Skeleton screens for board and cards
- **Turn Execution**: Progress bar with register highlighting
- **Player Actions**: Subtle loading spinners
- **Template Loading**: Progressive image loading