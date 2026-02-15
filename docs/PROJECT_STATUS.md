# ReGen28 Wellness App – Project Checklist

> **Tech Stack**: Ionic 8 + Angular 20 + Firebase + Capacitor  
> **Last Updated**: 2026-02-14

---

## 📋 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Development Standards](#-development-standards)
3. [Completed Phases](#-completed-phases)
4. [Current Work in Progress](#-current-work-in-progress)
5. [Upcoming Phases](#-upcoming-phases)
6. [Quick Reference](#-quick-reference)

---

## 🏗️ Architecture Overview

### Core Infrastructure Services
| Service | Purpose |
|---------|---------|
| **ErrorHandlingService** | Centralized error management with standardized codes (AUTH, DATA, NETWORK, AI, FIREBASE) |
| **LoggingService** | Environment-aware structured logging (debug/info/warn/error) |
| **ConfigService** | Single source of truth for app configuration, tracker templates, and defaults |
| **DatabaseService** | Abstract layer for all Firebase operations with error handling and caching |

### AI Models & SDKs
| Component | SDK / Model | Purpose |
|-----------|-------------|--------|
| **Image Generation (Standard)** | `@google/genai` → `gemini-2.5-flash-image` | Nano Banana Standard — motivational & contextual images |
| **Image Generation (Pro)** | `@google/genai` → `gemini-3-pro-image-preview` | Nano Banana Pro — reference image editing (pending access) |
| **Text Generation** | `openai` → GPT-4o-mini | Prompt generation, insights, action posts |
| **Auth Method** | Vertex AI (service account) | No API key needed in Cloud Functions |

### Service Layer
| Service | Purpose |
|---------|---------|
| **AuthService** | Authentication with comprehensive error handling |
| **UserService** | User profile management, stats, preferences |
| **TrackerService** | Tracker CRUD, analytics, duration management |
| **GoalService** | Goal CRUD, progress tracking, milestone calculations |
| **JournalService** | Journal entries with mood tracking and analytics |
| **ActivityService** | Activity logging and history |
| **AchievementService** | Achievements and gamification |
| **OnboardingService** | Multi-step flow with AI integration |
| **StatisticsService** | Pre-calculated analytics and metrics |
| **TrackerSuggestionsService** | AI-powered tracker recommendations |
| **LoggingModalService** | Global modal state management |
| **GeminiImageService** | Nano Banana image generation via Vertex AI |
| **NotificationService** | Local and Push notification management (FCM) |

### Client-Server Configuration
- **Client**: `src/app/services/config.service.ts`
- **Server**: `functions/src/shared-config.ts`
- Both maintain identical tracker templates for consistency

### Data Flow
```
Components → Services → DatabaseService → Firebase
                ↓
     ErrorHandlingService (error handling)
                ↓
     LoggingService (structured logs)
```

---

## ⚙️ Development Standards

### ✅ Required Practices
| Practice | Description |
|----------|-------------|
| **Centralized Logic** | All business logic in dedicated services, not components |
| **Single Source of Truth** | One location for configuration, templates, defaults |
| **Real Data Only** | No `Math.random()`, hardcoded values, or placeholder data |
| **Graceful Error Handling** | Use ErrorHandlingService patterns consistently |
| **Type Safety** | Comprehensive TypeScript interfaces and null checks |
| **Structured Logging** | Use LoggingService exclusively |
| **Database Abstraction** | All Firebase operations through DatabaseService |
| **Observable Patterns** | Use RxJS with `shareReplay(1)` caching |

### ❌ Forbidden Practices
- Duplicate code across components/services
- Hardcoded values scattered throughout codebase
- Fallback mechanisms or emergency try-catch with repetitive content
- `console.log` statements (use LoggingService)
- Direct Firebase calls (use DatabaseService)
- Temporary solutions or "TODO" fixes
- Fake data with `Math.random()`

### 🎨 Design Principles
- **Horizontal Scrolling** for content collections
- **Global Reading Modes** for expand/collapse states
- **Color Psychology**: Emerald/teal (action), purple/blue (wellness)
- **Glass Morphism & Gradients** for premium feel
- **Progressive Disclosure** for information layering

---

## ✅ Completed Phases

### Phase 0: Architecture Alignment ✅
- Clean Ionic + Angular architecture with Firebase backend
- DatabaseService abstraction and centralized core services
- Key data models defined with architecture diagram

### Phase 1: Project Setup & Foundation ✅
- Node 22.17, Ionic CLI configuration
- Tabs-based Ionic Angular app with Capacitor
- Firebase initialization (Auth, Firestore, Functions)
- Shared styling & navigation

### Phase 2: UI Implementation & Design System ✅ 
- Tailwind CSS design system integration
- Font Awesome & Inter font
- Pixel-perfect Dashboard, Tracker, Journal, and Settings pages

### Phase 3: Technical Integration ✅
- Tailwind/PostCSS setup with global.scss utilities
- Semantic HTML and standardized component architecture

### Phase 4: Core Functionality & Data Models ✅
- **Authentication**: Email/password & Google Sign-In with guards
- **TypeScript Interfaces**: User, Tracker, Journal, Goals, Activity, Achievements, Settings
- **Core Services**: Database, ErrorHandling, Logging, Fallback services
- **35+ Tracker Templates** in centralized ConfigService
- **Cloud Functions**: `completeUserOnboarding`, `updateUserStats`, `onTrackerEntryCreated`, `checkExpiredTrackers`

### Phase 4.5: AI-Powered Onboarding ✅
- 5-step flow: Welcome → Profile → Goals → Trackers → Complete
- AI tracker recommendations using OpenAI GPT-4o-mini
- Platform-specific UI with native date pickers
- User data collection (gender, birthday, goals, preferences)
- Duration system with age-aware coaching

### Phase 5: Dashboard & Performance ✅
- Real-time dashboard with profile, stats, activity feed
- AI daily suggestions & quick actions
- `shareReplay` caching with ~80% Firebase query reduction
- Firestore indexes and load time optimization

### Phase 5.5: Codebase Cleanup & Centralization ✅
- Centralized error handling and structured logging
- Shared configuration across client & Functions
- Removed duplicate code, fake data, console.logs
- Production-ready Cloud Functions

### Phase 6: Tracker Logging & AI Enhancements ✅
- **TrackerLogModal**: 10+ logging fields (mood, energy, duration, intensity, quality, social context, tags, notes, custom date)
- **LoggingModalService**: Global modal state management
- Age-aware AI coaching with proper journey descriptions
- Enhanced AI creativity controls
- Complete elimination of hardcoded fallbacks

### Phase 6.5: Android Mobile Build Setup ✅
- Capacitor with app ID `com.regen28labs`
- Java 21 (Eclipse Temurin JDK 21.0.9.10)
- Environment variables (`JAVA_HOME`, PATH)
- TypeScript compiler target (ES2022), CSS budget limits
- CORS configuration for `https://localhost` origin
- **6 Capacitor Plugins**: Firebase Auth, App, Device, Haptics, Keyboard, Status Bar
- Debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`
- **NPM Scripts**:
  - `build:android` – Build web + sync to Android
  - `build:android:apk` – Full pipeline with APK generation
  - `open:android` – Open in Android Studio
  - `sync:android` – Sync web assets

### Phase 7: Journal Page Functionality ✅
**Implemented Components** (`src/app/components/journal/`):
- ✅ `journal-entry-card.component.ts`
- ✅ `mood-tracker/` (3 files)
- ✅ `journal-prompts/` (3 files)
- ✅ `journal-stats.component.ts`
- ✅ `write-entry-modal/` (3 files)

### Phase 7.5: Comprehensive Statistics System ✅
**Backend Implementation** (`functions/src/statistics.service.ts` - 1081 lines):
- ✅ `UserDailyStats` interface with 40+ metrics
- ✅ `TrackerDailyStats` interface with adherence & trends
- ✅ `JournalDailyStats` interface with mood/word analytics
- ✅ `calculateUserDailyStats()` – Main orchestrator
- ✅ `calculateFrequencyAwareStreak()` – Daily/Weekly/Monthly
- ✅ `calculateTrend()` – Improving/Stable/Declining
- ✅ `calculateOverallStreak()` – Cross-feature activity
- ✅ `calculateConsistencyScore()` & `EngagementRate`
- ✅ `calculateMoodCorrelation()` – Pearson correlation
- ✅ `calculateWellnessScore()` – Universal wellness algorithm
- ✅ Milestone progress (7, 14, 30, 100+ day streaks)

**Utility Functions**:
- ✅ `calculateAdherence()` – Universal tracker frequency
- ✅ `getTargetForFrequency()` – Target count by frequency
- ✅ `calculateCategoryBreakdown()` – Category distribution
- ✅ `calculateOverallMoodFromAllSources()` – Multi-source aggregation
- ✅ `countWords()` – Journal word counting

### Goals Feature ✅
- **GoalService**: Full CRUD with reactive data streams
- **Goal Interface**: Categories (mind, body, soul, beauty, custom)
- **Dashboard Integration**: Active goals with progress bars
- **Goals Page** (`src/app/pages/goals/`): Dedicated management with add/edit/complete

### Activities & Recent Activity Feed ✅
- **Activity History Page** (`src/app/pages/activities/`): Dedicated view for full user history
- **Navigation Fixes**: Corrected dashboard "View All" links and "Explore Deeper" navigation
- **Automated Logging**: 
  - Ritual completion now triggers Recent Activity records
  - Journal entries automatically appear in the activity feed
  - Goal creation and completion logged as accomplishments
- **Design Alignment**: Premium glass-morphism cards with dynamic icon gradients and "time ago" logic

### Tracker Components & Features ✅ COMPLETED
**Component Architecture** (`src/app/components/`):
- ✅ `tracker-card/` – Enhanced with duration displays, milestones, trends, adherence
- ✅ `tracker-stats/` – Weekly summary
- ✅ `tracker-suggestions/` – AI recommendations
- ✅ `tracker-log-modal/` – Entry logging
- ✅ `completed-challenges/` – Achievement display with restart capability
- ✅ `add-tracker-modal/` – 4-step wizard for new tracker creation
- ✅ `tracker-list-item/` – Swipe actions wrapper component


**Tracker Features** ✅ COMPLETED:
- ✅ Real-time progress bars with gradient styling
- ✅ Duration-aware displays (remaining days / infinity symbol for ongoing)
- ✅ Milestone progress tracking (7/14/30/60/100 day streaks)
- ✅ Trend indicators (improving/stable/declining)
- ✅ Swipe actions (edit, delete, pause, resume, extend, complete)
- ✅ Category-based color coding (Mind/Body/Soul/Beauty/Custom)
- ✅ Challenge ↔ Ongoing mode toggle with streak preservation

### Statistics Integration ✅ COMPLETED
**Client-Side Service Methods**:
- ✅ `StatisticsService.getUserDailyStats(days)` 
- ✅ `StatisticsService.getOverallMoodAnalytics()`
- ✅ `StatisticsService.getPerformanceInsights()`
- ✅ `StatisticsService.getTrackerDailyStats(trackerId, days)`
- ✅ `StatisticsService.getTrackerTrends(trackerId)`
- ✅ `StatisticsService.getTrackerMilestones(trackerId)`

**Backfill System** ✅ COMPLETED:
- ✅ `backfillUserDailyStats()` – Historical data with resume capability
- ✅ `backfillAllUsers()` – Batch processing with concurrency control
- ✅ `validateBackfillData()` – Data quality validation
- ✅ `repairMissingStats()` – Auto-repair missing stats
- ✅ Progress tracking in `backfill-progress` collection


---

## 📅 Upcoming Phases

### Phase 8: Settings & User Management ✅ COMPLETED
- Profile management with edit modal
- Image upload functionality
- Preference persistence
- Developer mode toggle

### Phase 8.5: Social Feed Enhancements ✅ COMPLETED
**Feed Post Types** (`src/app/components/feed/cards/`):
- ✅ `feed-tracker-card/` – Full-width gradient tracker entries
- ✅ `feed-stat-card/` – Daily wellness check
- ✅ `feed-guidance-card/` – Square swipeable carousel (actions & insights)
- ✅ `feed-inspiration-card/` – Square swipeable carousel (motivational quotes)
- ✅ `feed-milestone-card/` – Achievement celebrations
- ✅ `feed-journal-card/` – Journal entry previews
- ✅ `feed-activity-card/` – Generic activity posts
- ✅ `feed-action-card/` – Individual daily action posts per tracker
- ✅ `feed-insight-card/` – Individual strategic insight posts per tracker

**Feed Features**:
- ✅ User profile avatars with Dicebear fallback
- ✅ AI Coach bot avatars with gradient borders
- ✅ Separate posts for Today's Actions and Strategic Insights
- ✅ Daily Inspiration post type with motivational quotes
- ✅ Touch/swipe gestures for carousel navigation
- ✅ Tap-to-expand for detailed metadata
- ✅ Full-width card layout (edge-to-edge)
- ✅ Tracker name headers on guidance cards
- ✅ Icon circles with category emojis
- ✅ Dot indicators for multi-card carousels
- ✅ Proper text wrapping and overflow handling

### Phase 8.6: Action & Insight Feed System ✅ COMPLETED
**Architecture** (`functions/src/feed/action-insight-generator.ts`):
- ✅ Scheduled action generation (6 AM UTC daily)
- ✅ Scheduled insight generation (12 PM UTC daily)
- ✅ One post per tracker per day for actions
- ✅ One post per tracker per day for insights
- ✅ Historical feed storage in `feed-items` collection
- ✅ Last 30 days context to avoid repetition

**Cloud Functions**:
- ✅ `generateDailyActionPosts` – Scheduled function for morning actions
- ✅ `generateInsightPosts` – Scheduled function for midday insights
- ✅ `triggerActionPostsForUser` – Manual trigger for testing
- ✅ `triggerInsightPostsForUser` – Manual trigger for testing

**Frontend Integration**:
- ✅ `FeedService.getFeedItemsFromFirestore()` – Read from feed-items collection
- ✅ `FeedService.getTodaysActionsAndInsights()` – Filter for dashboard
- ✅ `DatabaseService.triggerActionPosts()` – Manual trigger method
- ✅ `DatabaseService.triggerInsightPosts()` – Manual trigger method
- ✅ Feed displays full history of actions/insights
- ✅ Dashboard can filter for today's posts

**Data Model**:
- ✅ Extended `FeedItem` interface with `action` and `insight` types
- ✅ Added `metadata` field for icon, reason, insightType, dataPoint
- ✅ Added `dateKey` field for efficient day-based queries
- ✅ Source tracking with `trackerId` and `trackerName`

**Documentation**:
- ✅ `docs/ACTION_INSIGHT_FEED_SYSTEM.md` – Complete system documentation

### Phase 8.7: AI-Powered Feed Generation (Nano Banana) ✅ COMPLETED
**Core System** (`functions/src/feed/feed-generation.ts`):
- ✅ **Daily Motivational Posts**: Scheduled (6 AM) via OpenAI + Gemini
- ✅ **Daily Contextual Posts**: Scheduled (12 PM) based on user activity
- ✅ **Smart Fallback**: Generates diverse characters if no reference photo exists
- ✅ **Reference Image Support**: Use uploaded face/body photos for personalized generation
- ✅ **Developer Controls**: Model switching (Standard vs Pro) and manual triggers

**Personalization (Enhanced 2026-02-11)**:
- ✅ **Motivational Posts** use: Active trackers, goals, recent stats, user profile (age/gender), wellness goals, focus areas, mood data
- ✅ **Contextual Posts** use: Recent achievements, streaks (overall/journal/tracker), wellness score, milestone progress
- ✅ **Context Storage**: Posts store metadata about user state at generation time
- ✅ **Age Calculation**: Helper function for age-appropriate character descriptions
- ✅ **Settings Respect**: Uses reference images only when Pro model enabled, respects style preferences
- ✅ **Location & Date Context**: Prompts now include user location (City, Country), current date, season, and time of day
- ✅ **User Profile**: Added location field to user model, onboarding flow, and settings

**AI SDK (Updated 2026-02-12)**:
- ✅ Migrated from `@google/generative-ai` + `@google-cloud/vertexai` → unified `@google/genai`
- ✅ Vertex AI auth (service account) — no API key needed in Cloud Functions
- ✅ `input_fidelity: "high"` enabled for OpenAI GPT-1.5 (Face/Body preservation)
- ✅ Parallel execution for image generation (3x speedup)
- ✅ **Smart Fallback**: OpenAI <-> Gemini auto-switching with full reference image support
- ✅ Standard model (`gemini-2.5-flash-image`) tested & deployed ✅
- ⏳ Pro model (`gemini-3-pro-image-preview`) pending regional access
- ✅ TypeScript upgraded to 5.4 for zod v4 compatibility

**Services**:
- ✅ `GeminiImageService` – Nano Banana via `@google/genai` + Vertex AI auth
- ✅ `OpenAIService` – Creative direction prompts + High Fidelity generation
- ✅ `feed-generation.ts` – Parallel orchestration with 540s timeouts
- ✅ `feed-jobs.ts` – Media jobs processor using `@google/genai`

**Documentation**:
- ✅ `docs/FEED_SYSTEM.md` – Complete system documentation (Updated 2026-02-12)
- ✅ `docs/FEED_GENERATION_ENHANCEMENT.md` – Personalization details


### Phase 8.8: Scalable Feed Architecture (Cloud Tasks) ✅ COMPLETED
**Architecture Upgrade (2026-02-12)**:
- ✅ **Fan-out Pattern**: Schedulers now enqueue tasks instead of processing users directly.
- ✅ **Cloud Tasks**: Dedicated task queues for resource-intensive operations.
- ✅ **Isolated Execution**: Each user gets a dedicated function instance with independent timeout/memory.

**Task Queues Implemented**:
- ✅ `generateMotivationalPostTask`: Handles image generation (10 concurrent, 540s timeout).
- ✅ `generateContextualPostTask`: Handles contextual posts (10 concurrent, 540s timeout).
- ✅ `calculateUserStatsTask`: Handles daily stats calculation (50 concurrent, 300s timeout).

**Benefits**:
- ✅ **Zero Timeouts**: Slow processing for one user doesn't affect others.
- ✅ **Automatic Retries**: Transient failures (e.g. OpenAI 500) are retried automatically per user.
- ✅ **Rate Limit Compliance**: Concurrency controls prevent exceeding limits (OpenAI/Vertex AI).

### Phase 8.9: Personalized Post Scheduling ✅ COMPLETED
- ✅ **Logic**: Posts generated at Wake time (Morning), Midday (Check-in), and BedTime - 2h (Reflection).

### Phase 8.9.1: Unified Feed & Notification System ✅ COMPLETED
**Architecture Upgrade & Cleanup (2026-02-14)**:
- ✅ **Unified Backend**: Consolidated scattered generation logic into `unified-feed.ts` using a **Strategy Pattern**.
- ✅ **Notification System (Push)**: Integrated Firebase Cloud Messaging (FCM) for all feed post types (Motivational, Action, Insight, Summary, etc.).
- ✅ **Backend Cleanup**: Permanently deleted 3+ obsolete Cloud Functions (`scheduleUserPosts`, `scheduleWeeklyWrapped`, `processFeedMediaJobs`) and retired the old job-based image generation system.
- ✅ **Local Notifications**: Implemented ritual reminders tied to tracker schedules and a manual "Test Notification" utility.
- ✅ **User Preferences**: Added "Coaching Feed" toggle for notification control.
- ✅ **Native Sync**: Full Capacitor synchronization for Android and iOS avec proper platform-specific permissions.
- ✅ **Frontend Refactor**: Updated `DatabaseService` and developer triggers to use the single `triggerFeedPost` endpoint.
- ✅ **Code Quality**: Deleted redundant files (`feed-jobs.ts`, `card-templates.ts`) and streamlined `index.ts` exports.

---

## 🚧 Current Work in Progress

### Phase 9: Offline Support & PWA
- [ ] Service worker implementation
- [ ] Offline data caching
- [ ] Background sync

### Phase 10: Native Features & Mobile Optimization
- ✅ Push notifications
- [ ] Biometric authentication
- [ ] Camera integration for progress photos
- ✅ iOS platform setup (Capacitor Sync & Config)
- [ ] App Store / Play Store production builds

### Phase 11: Advanced Analytics & AI Insights
- [ ] Enhanced mood correlation analysis
- [ ] Predictive wellness recommendations
- [ ] AI-generated weekly summaries
- [ ] Pattern recognition for habits

### Phase 12: Testing & Quality Assurance
- [ ] Unit test coverage
- [ ] E2E testing with Cypress
- [ ] Performance profiling
- [ ] Accessibility audit

### Phase 13: Deployment & Production
- [ ] Signed release APK with keystore
- [ ] Google Play Store submission
- [ ] Firebase App Distribution for beta
- [ ] ProGuard/R8 optimization

### Phase 14: Post-Launch Monitoring
- [ ] Analytics integration
- [ ] Crash reporting
- [ ] User feedback system
- [ ] Performance monitoring

---

## 📚 Quick Reference

### Project Structure
```
regen28/
├── src/app/
│   ├── components/          # Reusable UI components
│   │   ├── journal/         # Journal components (16 files)
│   │   ├── tracker-*/       # Tracker components
│   │   └── settings/        # Settings components
│   ├── pages/               # Route pages
│   │   ├── auth/            # Login/Register
│   │   ├── goals/           # Goals management
│   │   ├── onboarding/      # 5-step onboarding
│   │   └── tabs/            # Main tab pages
│   └── services/            # 18 service files
├── functions/src/           # Firebase Cloud Functions
│   ├── index.ts             # Function exports
│   ├── feed/                # Feed generation & media jobs
│   ├── services/            # GeminiImageService, etc.
│   ├── statistics.service.ts
│   ├── shared-config.ts
│   └── user-management.ts
└── android/                 # Native Android project
```

### Key NPM Scripts
```bash
npm start                    # Development server
npm run build               # Production build
npm run build:android:apk   # Build Android APK
npm run lint:fix            # Fix linting issues
```

### Firebase Collections
- `users` – User profiles and preferences
- `trackers` – Active/completed trackers
- `tracker-entries` – Individual log entries
- `journal-entries` – Journal entries
- `goals` – User goals
- `activities` – Activity log
- `achievements` – Earned achievements
- `user-daily-stats` – Pre-calculated daily stats
- `tracker-daily-stats` – Tracker-specific daily stats
- `journal-daily-stats` – Journal analytics
- `feed-items` – AI-generated feed content (actions, insights, motivational, contextual)
- `feed-media-jobs` – Queued media generation jobs

---

## 🎯 Current Priority

**Next Immediate Steps**:
1. Implement PWA support for offline caching and background sync
2. Push notification system for ritual reminders
3. Biometric authentication for enhanced security
4. Advanced pattern recognition for habit-mood correlations

---

*This document serves as the single source of truth for ReGen28 development progress and architecture.*