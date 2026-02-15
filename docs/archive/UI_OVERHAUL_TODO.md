# ReGen28 UI/UX Overhaul - Master Todo List

> **Goal**: Create a cohesive, premium wellness app experience  
> **Philosophy**: Dashboard as "command center" - see everything at a glance  
> **Date Created**: 2026-02-05  
> **Last Updated**: 2026-02-05  
> **Status**: Phase 4 COMPLETE ✅ | Phase 6 IN PROGRESS 🏗️

---

## 🎯 Core Design Principles

### Visual Hierarchy
1. **Clear section separation** - Noticeable visual breaks between major areas
2. **Smart grouping** - Related content consolidated together
3. **3 color families** - Not 8 competing gradients
4. **Consistent patterns** - Same card styles, same headers, same spacing

### The 3 Color Families
| Family | Gradient | Usage |
|--------|----------|-------|
| **Calm Focus** | Purple → Blue | Stats, metrics, mind-related |
| **Active Energy** | Emerald → Teal | Actions, CTAs, "do now" |
| **Warm Glow** | Amber → Orange | Streaks, achievements, celebration |

---

## 📋 PHASE 1: Dashboard Consolidation ✅ COMPLETE

### 1.1 Section Structure Redesign ✅ DONE

The dashboard has been consolidated from **10+ scattered sections** into **6 well-organized sections** with clear visual separators:

| Section | Content | Status |
|---------|---------|--------|
| **1. Welcome Header** | Profile + greeting + Today's Renewal progress | ✅ Done |
| **2. Today's Guidance** | MERGED: Intentions + AI Insights (one scroll) | ✅ Done |
| **3. Your Wellness** | MERGED: Energy Flow + Engagement + Growth | ✅ Done |
| **4. Mind & Trackers** | Mood chart + Top performing trackers | ✅ Done |
| **5. Progress Overview** | MERGED: Categories + Active Goals | ✅ Done |
| **6. Timeline & Tools** | MERGED: Activity + Quick Actions + Wisdom | ✅ Done |

### 1.2 Section Separators ✅ DONE

Each section now has a clear visual separator:
```html
<div class="px-6 py-4">
  <div class="flex items-center gap-3">
    <div class="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
    <div class="w-1.5 h-1.5 rounded-full bg-[color]-400"></div>
    <div class="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
  </div>
</div>
```

Color-coded dots for each section:
- Emerald → Today's Guidance
- Purple → Your Wellness
- Blue → Mind & Trackers
- Rose → Progress Overview
- Amber → Timeline & Tools

### 1.3 Consolidation Details

#### Today's Guidance (Section 2)
- [x] Created unified section header with sparkles icon
- [x] AI Powered badge
- [x] Combined Action cards (emerald gradient) + Insight cards (white)
- [x] Single horizontal scroll with both card types
- [x] Single set of scroll indicator dots
- [x] Expandable detail views

#### Your Wellness (Section 3)
- [x] Hero wellness score card (purple/blue gradient)
- [x] 3 metric glass cards inline (Mood, Consistency, Streak)
- [x] 4-column compact stats grid (Sessions, Journal, Days, Active)
- [x] Inline weekly engagement bar chart
- [x] Removed separate "Your Engagement" section
- [x] Removed separate "Your Growth" section

#### Progress Overview (Section 5)
- [x] Categories grid made 20% more compact
- [x] Active Goals integrated below categories
- [x] View All Goals link added

#### Timeline & Tools (Section 6)
- [x] Recent Activity feed (4 items max)
- [x] Quick Actions as 2x2 grid (more compact)
- [x] Daily Inspiration (single quote) at bottom
- [x] Wellness Tools merged into Quick Actions

### 1.4 Removed/Consolidated
- [x] Removed duplicate streak displays
- [x] Removed separate "Your Engagement" card
- [x] Removed separate "Your Growth" card
- [x] Combined 3 horizontal scrolls into 1
- [x] Reduced Wellness Tools from large cards to compact grid

---

## 📋 PHASE 2: Journal Page Overhaul ✅ COMPLETE

### 2.1 Header Redesign ✅ DONE
- [x] Switched to Purple Gradient header matching "Tracker" page (User Request)
- [x] Implemented "Sacred" design language (Serif fonts, dark theme)
- [x] Inline glassmorphism stats header
- [x] Consistent visual identity with Tab 3

### 2.2 Journal Stats ✅ DONE
- [x] Redesigned to match dashboard wellness card style
- [x] Placed at top under header
- [x] Compact stat grid (weekly, streak, avg mood) with dynamic subtext

### 2.3 Recent Entries ✅ DONE
- [x] Moved up to 2nd position
- [x] Redesigned with date badge layout
- [x] Improved list styling to match Activity feed

### 2.4 Write Entry CTA ✅ DONE
- [x] Premium dark gradient card to stand out
- [x] Moved to 3rd position
- [x] Added decorative elements

### 2.5 Prompts Section ✅ DONE
- [x] Moved to bottom as "Inspire Me" section
- [x] Horizontal scroll cards similar to dashboard insights
- [x] Daily Focus highlight card

### 2.6 Section Separators ✅ DONE
- [x] Added visual separators between all major sections matching dashboard style

---

## 📋 PHASE 3: Tracker Page Overhaul (Tab 3) ✅ COMPLETE

### 3.1 Header & Stats
- [x] Align header visualization with Dashboard and Journal standards ✅ DONE
- [x] Refine `Today's Flow` progress visualization (more compact/premium) ✅ DONE
- [x] Update `app-tracker-stats` to use new glassmorphism cards vs solid blocks ✅ DONE

### 3.2 Your Activities List
- [x] Group trackers by Category (Mind, Body, Soul, Beauty) for better organization ✅ DONE
- [x] Implement smart sections: "Do Next" vs "Completed" ✅ DONE
- [x] Visual separators between categories ✅ DONE
- [x] Improve `app-tracker-card` visual design (premium feel, easier tap targets) ✅ DONE
- [ ] Add "Quick Log" grid for rapid entry of simple trackers (Low Priority)

### 3.3 Add New Activity Flow
- [x] **Redesign "Browse Templates" vs "Custom" selection** to be more visual/inspiring ✅ DONE
- [x] Simplify the creation wizard steps ✅ DONE
- [x] Add "Recommended for You" section based on missing categories ✅ DONE

### 3.4 Visual Improvements
- [x] Add standard section separators ✅ DONE
- [x] Refine "Create" and "Log" buttons (make them less overwhelming) ✅ DONE
- [x] Celebrated Completions section redesign (Gold/Amber theme) ✅ DONE
- [x] Implemented premium entry animations ✅ DONE

---

## 📋 PHASE 4: Settings Page Overhaul ✅ COMPLETE

### 4.1 Header Redesign
- [x] Add gradient header (warm/neutral tones) ✅ DONE
- [x] Integrate profile card into header ✅ DONE
- [x] Stats ribbon (Days, Practices, Entries) ✅ DONE

### 4.2 Settings Groups
- [x] Add section headers with icons like dashboard ✅ DONE
- [x] Glass morphism style for setting cards ✅ DONE
- [x] Gradient icon containers ✅ DONE
- [x] Improved toggle switches (emerald when ON) ✅ DONE

### 4.3 Visual Improvements
- [x] Section separators between groups ✅ DONE
- [x] Developer mode styled distinctly (amber) ✅ DONE
- [x] Sign out as distinct action (outlined red) ✅ DONE
- [x] Added Achievements Preview integration ✅ DONE
- [x] Implemented premium entry animations ✅ DONE

---

## 📋 PHASE 5: Component Alignment

### 5.1 Shared Header Component ✅ DONE
- [x] Create reusable `app-page-header` component
- [x] Props: gradient type, title, subtitle, showProfile, actionIcon

### 5.2 Section Separator Component ✅ DONE
- [x] Create reusable `app-section-separator` component
- [x] Consistent styling across all pages

### 5.3 Card Styles
- [x] Standardize `.card-elevated`, `.card-gradient`, `.card-glass` ✅ DONE
- [x] Apply consistently across all pages ✅ DONE

### 5.4 Modals
- [x] Update Tracker Log Modal header ✅ DONE
  - Implemented premium glassmorphism design
  - Added tracker category theming
  - Fixed log scrolling issues with robust `ion-content` layout
  - Added dynamic fields (Photos, Social Context) with collapsible animations
- [x] Update Write Entry Modal header ✅ DONE
- [x] Update Edit Profile Modal header ✅ DONE
- [x] Update Add Tracker Modal header ✅ DONE

---

## 📋 PHASE 6: Micro-Interactions & Polish

### 6.1 Animations ✅ DONE
- [x] Fade-in/Slide-up for section content (animate-entry) ✅ DONE
- [x] Progress bar fill animations ✅ DONE
- [/] Number count-up for stats (In Progress - Dashboard/Trackers done)
- [x] Subtle hover/active states ✅ DONE
- [x] Floating orbs and glow effects ✅ DONE

### 6.2 Loading States
- [x] Skeleton loaders with shimmer ✅ DONE (Dashboard, Journal, Tracker)
- [x] Consistent spinner styling ✅ DONE


---

## 📅 Implementation Progress

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Dashboard Consolidation | ✅ COMPLETE |
| Phase 2 | Journal Page Overhaul | ✅ COMPLETE |
| Phase 3 | Tracker Page Overhaul | ✅ COMPLETE |
| Phase 4 | Settings Page Overhaul | ✅ COMPLETE |
| Phase 5 | Component Alignment | ✅ COMPLETE |
| Phase 6 | Polish & Animations | 🏗️ Near Completion |

---

## 📝 Quick Reference

### Section Header Pattern
```html
<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-semibold text-neutral-900 flex items-center space-x-2">
    <i class="fa-solid fa-[icon] text-[color]-600"></i>
    <span>Section Title</span>
  </h2>
  <button class="text-sm text-neutral-500 font-medium">View all</button>
</div>
```

### Section Separator Pattern
```html
<div class="px-6 py-4">
  <div class="flex items-center gap-3">
    <div class="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
    <div class="w-1.5 h-1.5 rounded-full bg-[color]-400"></div>
    <div class="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
  </div>
</div>
```

### Card Pattern
```html
<div class="bg-white rounded-3xl p-5 shadow-md border border-neutral-100">
  <!-- content -->
</div>
```

---

*Last Updated: 2026-02-05*
