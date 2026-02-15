# ReGen28 - Common Commands Cheat Sheet

## 1. Web Development & Local Testing

### Run Locally
```bash
# Standard local development
npm start

# Run with network access (for testing on other devices/network)
npm run start:network
```

### Code Quality
```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix

# Check for unused exports and dead code
npm run dead-code:full
```

## 2. Android Development
*Note: Run `npm run build:android` first.*

```bash
# Build app and sync with Android project
npm run build:android

# Open in Android Studio
npm run open:android

# Sync Capacitor changes only (faster than full build)
npm run sync:android

# Build Debug APK directly
npm run build:android:apk
# Output: android\app\build\outputs\apk\debug\app-debug.apk

# View Logs
npx cap run android --list
npx cap run android --target <DEVICE_ID>
```

## 3. iOS Development (Mac Only)
See `docs/IOS_APPFLOW_TESTERS.md` for full details.

```bash
# Build and sync iOS
npm run build:ios

# Open Xcode
npm run open:ios

# Sync Capacitor changes
npm run sync:ios
```

## 4. Firebase Functions

### Deployment
> **Note on V2 Functions**: V2 functions require specific syntax for deployment.

```bash
# Deploy ALL functions
firebase deploy --only functions

# Deploy UNIFIED FEED (Scheduler + Workers + Triggers)
firebase deploy --only "functions:scheduleUserPosts,functions:generateFeedPostTask,functions:triggerFeedPost"

# Deploy STATS (Scheduler + Worker)
firebase deploy --only "functions:calculateAllDailyStats,functions:calculateUserStatsTask"
```

### 4.2 Fix Permissions (CORS/403 Forbidden)
V2 functions on Cloud Run sometimes lose their 'public' invoker status. Run this if you get CORS errors:

```bash
# Set invoker to public for a specific function
# Replace [service-name] with lowercase version of function name
gcloud run services add-iam-policy-binding [service-name] --member="allUsers" --role="roles/run.invoker" --region=us-central1 --project=regen28-2fe51 --quiet
```
*Note: [service-name] is usually all lowercase, e.g., `generatedailymotivationalpostscallable`*

### Local Testing
```bash
cd functions
npm run serve
```

### Logs
```bash
firebase functions:log
```

### AI Image Generation Testing
```bash
# Authenticate locally for Vertex AI
gcloud auth application-default login

# Run Nano Banana test scenarios
cd functions
node test-nano-scenarios.js
```

## 5. Database & Environment

```bash
# Deploy Firestore Rules
firebase deploy --only firestore:rules

# Deploy Firestore Indexes
firebase deploy --only firestore:indexes
```

## 6. Troubleshooting

```bash
# Rebuild Android completely
npm run build; npx cap sync android; cd android; .\gradlew assembleDebug; cd ..

# Reset Functions node_modules (Windows PowerShell)
cd functions; Remove-Item -Recurse -Force node_modules; Remove-Item package-lock.json; npm install; cd ..
```
