# Regen28 Feed System Architecture

> **Status**: Active / In Production
> **Last Updated**: February 2026

## 1. Overview
The Regen28 Feed System is the core engagement engine of the application, delivering personalized coaching, actionable insights, and motivational content to users daily. It replaces the traditional static dashboard with a dynamic, Instagram-style infinite scroll feed that evolves with the user's journey.

## 2. Core Architecture

### 2.1 High-Level Data Flow
1.  **Scheduling**: Cloud Functions run on schedules (Morning/Midday) to trigger the generation process.
2.  **Fan-out (Scalability)**: The scheduler queries all active users and enqueues a **Cloud Task** for each user, ensuring isolated execution and preventing timeouts.
3.  **AI Processing (Worker)**:
    *   **OpenAI (GPT-4)** generates text advice, insights, and actions.
    *   **Google Gemini (Nano Banana)** generates high-fidelity visual motivation (configured for editing capabilities).
4.  **Persistence**: Meaningful content is stored as `FeedItem` documents in Firestore.
5.  **Notifications**: The `NotificationService` (backend) automatically sends Push Notifications to the user when new feed items are created.
6.  **Presentation**: The frontend `FeedService` aggregates these posts with user activities (journals, tracker entries) into a unified timeline.

### 2.2 Key Components
*   **Feed Items**: The atomic unit of the feed (actions, insights, journals, etc.).
*   **Trackers**: The source of data for analysis.
*   **Cloud Tasks**: Managed queues for reliable, scalable execution of per-user jobs.
*   **Cloud Functions**: The computational layer (schedulers and workers).
*   **Frontend**: An Ionic/Angular list interface with specialized card components.

---

## 3. Backend Implementation (`functions/src/feed/`)

### 3.1 Unified Generation Logic
The backend was refactored from multiple individual generators into a **Unified Dispatcher** system to reduce code duplication, simplify error handling, and provide a single entry point for all feed content.

| Function/Unit | Type | Purpose | Source File |
| :--- | :--- | :--- | :--- |
| `dailyMaintenance` | **Daily Cron** | Consolidates all periodic checks, including user post scheduling logic. | `schedulers/daily-maintenance.ts` |
| `generateFeedPostTask` | **Task Queue** | **Unified Worker**: Processes all feed generation types (motivational, action, insight, contextual, morning, midday, evening, etc.) | `feed/unified-feed.ts` |
| `triggerFeedPost` | **Callable** | **Unified Trigger**: Public endpoint for manual/developer triggers for any post type. | `feed/unified-feed.ts` |
| `notificationService` | **Service** | Handles FCM push messaging for all feed items and token cleanup. | `services/notification.service.ts` |

### 3.2 Supported Post Types
*   **Motivational/Morning**: "Good Morning" / "New Motivation" alerts.
*   **Action**: "New Action Plan" (Specific tasks per tracker).
*   **Insight**: "Weekly Insight" (Data-driven analysis).
*   **Summary**: "Daily Summary" (Performance overview).
*   **Midweek**: Wednesday check-ins.
*   **Weekly**: Sunday wrap-ups.
*   **Progress/Cycle**: Challenge-based milestones (Skeleton).

### 3.2 Data Models (Firestore)
**Collection**: `feed-items` (Root collection)

### 3.2.1 Document Structure
```typescript
interface FeedItem {
  id: string;
  userId: string;
  type: 'action' | 'insight' | 'motivational' | 'contextual' | 'trackerEntry' | 'journal';
  title: string;
  body: string;
  
  // AI-Specific Data (root imageUrl used by generators for performance)
  imageUrl?: string; 
  prompt?: string;
  
  // Frontend-Preferred Data (Transformed by FeedService)
  media?: {
    images?: Array<{ url: string }>;
    status: 'ready' | 'processing';
  };

  // Metadata
  source?: {
    kind: 'ai-generated' | 'user-generated';
    id: string; // e.g., 'motivational', 'trackerId'
  };
  
  createdAt: Timestamp;
}
```
*Note: The frontend `FeedService` automatically maps `imageUrl` to `media.images` for backward compatibility and to support AI generators that store results at the document root.*

### 3.3 Prompt Engineering Strategy
*   **Actions**: Uses a 30-day history window to prevent repetitive advice. Prompts include user profile, tracker goals, and recent completion rates.
*   **Insights**: Focuses on pattern recognition (e.g., "You consistently meditate more on weekends").
*   **Visuals (High Fidelity)**: 
    *   **Generation Strategy**: Isolated Cloud Tasks per user to ensure full timeout window (9 mins) and retry capability.
    *   **Primary**: OpenAI `gpt-image-1.5` with `input_fidelity: "high"` for maximum detail.
    *   **Fallback**: Google Gemini (Nano Banana) via Vertex AI if primary fails.
    *   **Reference Images**: Both models now accept high-quality Buffer arrays of User Face + Body photos for consistent character generation.

### 3.4 Scalability Architecture (Fan-out Pattern)
To handle thousands of users without timeouts, the feed system uses a **Fan-out Architecture**:
1.  **Scheduler Function**: Runs **hourly**, queries users whose schedule matches the current hour (in their timezone), and enqueues a lightweight JSON payload (`{userId}`) to a Cloud Task Queue.
2.  **Task Queue**: Manages the rate of execution (e.g., 20 users/sec) to stay within API rate limits.
3.  **Worker Function**: Processes one user at a time with a dedicated 9-minute timeout. If a specific user fails (e.g. OpenAI error), only that task retries, not the entire batch.

---

## 4. Frontend Implementation (`src/app/components/feed/`)

### 4.1 Feed Service (`feed.service.ts`)
*   **Aggregation**: Combines `feed-items` (AI posts) with `activities` (User posts).
*   **Data Mapping**: Crucial logic that maps backend-generated `imageUrl` into the UI-compatible `media.images` structure.
*   **Sorting**: Chronological order (Newest first).
*   **Permissions**: Relies on a specific Firestore Security Rule allowing users to read `feed-items` where `userId == request.auth.uid`.

### 4.2 UI Components
*   **`FeedActionCardComponent`**: 
    *   Displays daily actions.
    *   Features a "Task Complete" interaction (Future roadmap).
    *   Expandable "Why this action?" section.
*   **`FeedInsightCardComponent`**:
    *   Displays data trends.
    *   Includes charts or highlighted metrics.
*   **`FeedGeminiCardComponent`** (Standard/Pro):
    *   Displays high-fidelity generated images.
    *   Supports full-screen image viewing.

---

## 5. Notification System

### 5.1 Push Notifications (FCM)
The app uses **Firebase Cloud Messaging** to notify users of new coaching content.
*   **Triggers**: Push messages are sent immediately after a `FeedItem` is successfully committed to Firestore.
*   **Preferences**: Respects `user.preferences.newFeedPostNotifications`.
*   **Token Management**: FCM tokens are stored in the user document (`fcmTokens` array). Invalid tokens are auto-pruned by the backend during the sending process.

### 5.2 Local Notifications
Used for ritual/tracker reminders that require high reliability regardless of network.
*   **Triggers**: Scheduled by the frontend based on `tracker.config.reminderTime(s)`.
*   **Lifecycle**: Auto-rescheduled/cancelled when the tracker is updated or deleted.
*   **Reliability**: Configured with `allowWhileIdle: true` on Android and critical alert options on iOS.

---

## 5. Subsystems

### 5.1 Nano Banana (Visual Engine)
The "Nano Banana" system is the advanced visual generation engine.
*   **tech**: Google Gemini 1.5 Pro / Flash & OpenAI GPT-1.5 Image.
*   **Capabilities**:
    *   **High Fidelity Mode**: `gpt-image-1.5` with `input_fidelity: "high"` preserves user features from reference photos.
    *   **Multi-Reference**: Supports both Face and Body reference photos simultaneously.
    *   **Smart Fallback**: Automatically switches providers (OpenAI <-> Gemini) if generation fails, ensuring delivery.
*   **Triggers**: Can be triggered manually via Developer Settings (Timeout extended to 9 mins).

---

## 6. Development & Deployment

### 6.1 Deployment Checklist
1.  **Memory**: Motivational/Contextual functions REQUIRE a minimum of **512MiB** memory.
2.  **Timeout**: Set `timeoutSeconds` to **540** (9 minutes) to accommodate parallel high-fidelity generation.
3.  **Cloud Tasks**: Ensure `onTaskDispatched` functions are deployed.
    *   **Rate Limits**: `maxConcurrentDispatches: 10` for image generation (OpenAI/Gemini limits), `50` for stats calculation.
    *   **Timeout**: `540s` for images, `300s` for stats.
4.  **IAM Policy**: Callable functions must be granted the `allUsers` invoker permission to avoid CORS/403 errors.

```bash
# 1. Deploy Functions (Including Task Queues and Schedulers)
firebase deploy --only functions:dailyMaintenance,functions:generateFeedPostTask,functions:triggerFeedPost

# 2. Set Invoker Permissions (Required for all callable functions)
gcloud run services add-iam-policy-binding triggerfeedpost --member="allUsers" --role="roles.run.invoker" --region=us-central1 --project=regen28-2fe51 --quiet
```

### 6.2 Manual Testing & Triggers
To manually generate posts for testing (bypassing the schedule), you can use the **Developer Tools** in the app or the **Firebase Console**.

#### Option A: In-App Developer Tools (Recommended)
1.  Go to **Settings** > **Experience**.
2.  Enable **"Developer Mode"**.
3.  Scroll down to the "Developer Tools" section.
4.  Click **"Generate Action Posts"** or **"Generate Insight Posts"**.
5.  Go to the **Feed** tab and refresh to see the new posts.

#### Option B: Firebase Console (Callable Functions)
You can call the functions directly from the Firebase Functions shell or a script:
*   `triggerFeedPost`: Use `{ type: 'action', force: true }`, `{ type: 'insight', force: true }`, etc.
*   `triggerStatsCalculation`: For manual statistics recalculation.

#### Option C: Browser Console
```javascript
// Get Angular service
const injector = ng.getComponent(document.querySelector('app-root')).injector;
const db = injector.get('DatabaseService');

// Trigger actions
db.triggerActionPosts().subscribe(res => console.log(res));
```

### 6.3 Testing Verification
When testing the feed system, verify the following:

1.  **Generation**:
    *   **Action Posts**: One per active tracker. Green/Emerald gradient.
    *   **Insight Posts**: One per active tracker (if data exists). Blue gradient.
    *   **Visual Posts**: One motivational image (if enabled).

2.  **Data Integrity**:
    *   Check Firestore `feed-items` collection.
    *   Ensure `dateKey` is correct (YYYY-MM-DD).
    *   Ensure `type` matches ('action', 'insight', 'motivational').
    *   Verify `source.trackerId` is present.

3.  **UI/UX**:
    *   Posts appear in the Feed tab (chronological).
    *   Today's posts appear in the Dashboard "Today's Guidance".
    *   Like/Comment functionality works.
    *   "Why this action?" expands correctly.

### 6.4 Common Issues
*   **CORS / 403 Forbidden**: Usually caused by missing `allUsers` invoker permission on the Cloud Run service. See Section 6.1.
*   **Function Timeouts (deadline-exceeded)**: AI image generation is heavy. We increased the timeout to **540 seconds** (9 mins). Ensure your frontend call matches this timeout.
*   **Empty Feed**:
    *   Verify the Firestore index for `feed-items` (userId, type, dateKey, createdAt) exists.
    *   Check if `feed-items` security rules allow read access.
    *   Ensure the `imageUrl` -> `media` mapping is active in `FeedService`.


