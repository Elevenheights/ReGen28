# Comprehensive Application Analysis: ReGen28

*Last Updated: 2026-02-05*
*Validated against codebase state (Angular 20, Ionic 8, Firebase 11)*

## 1. System Architecture Overview

ReGen28 is a **Resource-Oriented, Hybrid Mobile Application** built to help users rebuild habits over a 28-day cycle. It leverages a **Serverless Architecture** where the client handles UI state and the backend ensures data integrity and complex aggregation.

### Technology Stack
*   **Frontend**: Angular 20 (Standalone Components), Ionic 8, TailwindCSS 3.4
*   **Mobile Runtime**: Capacitor 7 (Android specific config exists)
*   **Backend**: Firebase Cloud Functions (v2), Firestore (NoSQL)
*   **AI Engine**: OpenAI Integration (via Cloud Functions) for personalized recommendations

---

## 2. Core Data Domain (`src/app/models`)

The application data is modeled around the "User Journey" of rebuilding specific habits ("Trackers").

### 2.1. The User Model (`User` interface)
The user document is the "Source of Truth" for global state.
*   **Identity**: `id`, `email`, `preferences` (Timezone, Notifications).
*   **Onboarding State**: `wellnessGoals`, `focusAreas`, `commitmentLevel` impacts which recommendations they receive.
*   **UserStats**: A massive, aggregated sub-object (not a separate collection query) containing:
    *   **Activity**: `totalTrackerEntries`, `totalJournalEntries`.
    *   **Streaks**: `currentStreaks`, `longestStreak`.
    *   **Wellness**: `overallAverageMood`, `energyTrend` (Calculated daily by backend).
    *   **Category Splits**: `totalMindMinutes`, `totalBodySessions`, etc.

### 2.2. The Tracker Model (`Tracker` interface)
Defines *configuration* for a habit.
*   **Core Config**: `target` (e.g., 10), `unit` (e.g., 'minutes'), `frequency` (Daily/Weekly).
*   **Visuals**: `color`, `icon`, `category` (MIND, BODY, SOUL, BEAUTY, CUSTOM).
*   **Logging Rules**: `config.loggingFields` uses `LoggingFieldConfig` to determine what the UI asks for:
    *   `value` (Always true).
    *   Optional toggles: `mood`, `energy`, `photos`, `location`, `weather`.
    *   *Note*: This config drives the `TrackerLogModalComponent`.

### 2.3. The Entry Model (`TrackerEntry` interface)
The immutable record of an action.
*   **Data Points**: `value`, `date`.
*   **Rich Context**: `mood` (1-10), `energy` (1-5), `notes`.
*   **Metadata**: `location` (Lat/Long), `weather`, `photos` (Array of URLs).

---

## 3. Business Logic & Services

The app splits logic between "Immediate UI Feedback" (Frontend Services) and "Data Consistency/Analytics" (Backend Functions).

### 3.1. Frontend Services (`src/app/services`)
*   **`DatabaseService`**: The primary data layer. Wraps Firestore SDK.
    *   Provides generic `createDocument`, `updateDocument`.
    *   Exposes `callFunction` to invoke backend logic.
    *   *Key Pattern*: Real-time observables (`docData`) for UI binding.
*   **`TrackerService`**: Manages the list of active trackers and handles the "Log Entry" action.
*   **`LoggingModalService`**: A singleton that manages the state of the Global Logging Modal (opening, closing, passing data).

### 3.2. Backend Cloud Functions (`functions/src`)
*   **`logTrackerEntry` (Callable)**:
    *   Validates ownership (User owns the Tracker).
    *   Enforces consistency.
    *   *Note*: Use this over direct Firestore writes for complex logs to ensure validation.
*   **`statistics-functions.ts`**: The Analytics Engine.
    *   **Triggers**: `onTrackerEntryCreated`, `onJournalEntryWritten` -> Immediately recalculate today's stats for the user.
    *   **Scheduled**: `calculateAllDailyStats` runs at **2 AM UTC** to perform heavy aggregations (Weekly averages, completion rates).
    *   **`getStatistics` (Callable)**: Public API for fetching specialized views (Performance charts, Weekly Mood).
*   **AI Recommendations (`openai.service.ts`)**:
    *   Generates habit suggestions based on user's `focusAreas` (Mind, Body, etc.).

---

## 4. Application Navigation & Flow

defined in `app.routes.ts` and `tabs.routes.ts`.

### 4.1. Onboarding Flow (`/onboarding/*`)
A strict linear guard-protected sequence:
1.  **Welcome**: Intro.
2.  **Profile**: Basic demographics.
3.  **Goals**: Select `wellnessGoals` (e.g., "Sleep Better") and `focusAreas`.
4.  **Trackers**: Users select from AI-suggested or default lists (`AVAILABLE_TRACKERS`).
5.  **Complete**: Finalizes profile, sets `isOnboardingComplete: true`.

### 4.2. Main App (`/tabs/*`)
*   **Dashboard (`/tabs/dashboard`)**:
    *   Shows user Streaks and Stats.
    *   "Recent Activity" feed.
*   **Journal (`/tabs/journal`)**:
    *   Rich text entries + Mood tracking.
*   **Tracker (`/tabs/tracker`)**:
    *   List of active habits.
    *   Clicking an item opens the `TrackerLogModal` (via `LoggingModalService`).
*   **Settings (`/tabs/settings`)**:
    *   App preferences (Dark mode, notifications).

---

## 5. Critical Code Paths

### 5.1. The Logging Lifecycle
1.  **User Action**: User taps a Tracker on `Tab3Page`.
2.  **Frontend**: `TrackerService` triggers `LoggingModalService.open()`.
3.  **User Input**: User fills details (Value, Mood, Note).
4.  **Submission**:
    *   `TrackerService` calls `logTrackerEntry` (Cloud Function) OR direct Firestore add (depending on offline needs). *Current recommendation is Cloud Function for validation.*
5.  **Reactive Update**:
    *   Cloud Function `onTrackerEntryCreated` fires.
    *   Recalculates `UserStats`.
    *   Frontend `Observable<User>` receives new stats immediately via Firestore sync.

### 5.2. Statistics Aggregation
*   **Real-time**: Simple counters (Total Entries) update immediately.
*   **Computed**: "Weekly Consistency" or "Mood Trends" are updated by the daily 2 AM Scheduler or on-demand via `getStatistics` API call.

---

## 6. Known Constraints & Notes
*   **Tracker Config Mismatch**: The backend `TrackerEntry` supports rich data (Weather, Location), but older Trackers (imported/default) may have `config.loggingFields` flags set to `false`, hiding these inputs in the UI.
*   **One-Way Sync**: AI Suggestions are generated once and stored. To refresh them, specific flags/functions must be triggered.
