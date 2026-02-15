# Backend Infrastructure

## Initialization

### `functions/src/init.ts`
To ensure Firebase Admin SDK is initialized correctly before any other modules, we use a dedicated initialization file:
- `init.ts`: Calls `admin.initializeApp()`.
- `index.ts`: Imports `./init` as the very first import.

**Why?**
This prevents "Firebase App not initialized" errors in Cloud Functions, especially during cold starts where top-level variables (like `db = getFirestore()`) might be evaluated before `initializeApp()` runs if imports are reordered or hoisting occurs.

## Deployment

### V2 Deployment Syntax
For deploying single 2nd Gen functions, specific syntax is required due to codebase configurations:

```bash
firebase deploy --only functions:triggerFeedPost
```

Wait, if "No function matches given --only filters" occurs, check:
1. Function name spelling.
2. Codebase configuration in `firebase.json`.
3. Try explicitly specifying the codebase: `firebase deploy --only functions:default:triggerFeedPost`

See `COMMANDS.md` for a quick reference.

## Function Configuration

### Public Invoker & CORS
For manual trigger functions (`triggerFeedPost`, etc.) intended to be called from the client app:
- **Invoker**: Must be explicit `invoker: 'public'` in function options.
- **CORS**: Handled automatically for `onCall` functions, but explicit handling might be needed for `onRequest`. Our current triggers use `onCall` which manages CORS under the hood for authorized clients, but for broad access, we ensure client SDKs are used.

### Secrets Management
- Use `defineSecret('OPENAI_API_KEY')` for secure API keys.
- Add `secrets: [openaiApiKey]` to function options to expose them at runtime.

### Cloud Tasks Integration
For resource-intensive or long-running operations (like AI image generation), we use Google Cloud Tasks to fan out execution.
- **Queue Configuration**: Defined in `onTaskDispatched` options (rate limits, retry config).
- **Benefits**: Scalability, isolation (per-user timeout), and automatic retries.

## Consolidated Functions List
(As of Feb 2026)

### Feed & Coaching (Unified)
- `scheduleUserPosts` (Scheduled Hourly Dispatcher)
- `generateFeedPostTask` (Task Queue - Unified Worker)
- `triggerFeedPost` (Callable - Unified Manual Trigger)
- `notificationService` (Push Messaging Management)

### User Management
- `completeUserOnboarding`
- `updateUserStats`
- `getTrackerSpecificSuggestions`
- `onTrackerEntryCreated` (Trigger)

### Statistics
- **Architecture**: Hybrid Real-time + Scheduled
  1. **Real-time**: `incrementUserDailyStats` helper triggers on every write (Tracker/Journal/Activity) to atomically increment totals in `user-daily-stats` (O(1) cost).
  2. **Scheduled**: `calculateAllDailyStats` runs nightly (2 AM UTC) to perform deep analysis, trend calculation, and historical correction.
- `calculateAllDailyStats` (Scheduled)
- `calculateUserStatsTask` (Task Queue - Worker)
- `incrementUserDailyStats` (Helper - Atomic)
- `triggerStatsCalculation` (Callable - Debug/Manual)
- `getStatistics` (Callable - Public API)

---

## Common Issues

### CORS Error / `net::ERR_FAILED` on Callable Functions

**Symptom**: Calling a Cloud Function from the client throws:
```
Access to fetch at 'https://us-central1-...' blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```
Followed by `FirebaseError: internal`.

**Root Cause**: Firebase Cloud Functions v2 run on Cloud Run. If a function is first deployed **without** `invoker: 'public'`, Cloud Run creates it with **private invocation only**. The browser's preflight OPTIONS request gets rejected by Cloud Run's IAM layer *before* the function code runs, so no CORS headers are ever set.

**Critical**: Simply adding `invoker: 'public'` to the code and redeploying does **NOT** always update the Cloud Run IAM policy. The IAM was set at initial deploy time and is now "stuck".

**Fix**: Manually set the IAM binding via gcloud:
```powershell
gcloud functions add-invoker-policy-binding FUNCTION_NAME `
  --region=us-central1 `
  --member="allUsers" `
  --project=regen28-2fe51
```

**Prevention**: Always include `invoker: 'public'` in the `onCall()` options **from the very first deploy**:
```typescript
// ✅ Correct pattern (matches working triggerStatsCalculation)
export const myCallableFunction = onCall({
  invoker: 'public',
  // secrets: [openaiApiKey],  // optional, doesn't affect CORS
}, async (request) => { ... });
```

**Affected Functions (Refactored to Unified Trigger Feb 2026)**:
- `triggerFeedPost` ✅
- `getStatistics` ✅ (Working)
- `triggerStatsCalculation` ✅ (Working)
- `getTrackerSpecificSuggestions` ✅ (Working)
