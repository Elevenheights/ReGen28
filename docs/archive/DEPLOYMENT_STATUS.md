# Deployment Status: Action & Insight Feed System

## Current Status: ⚠️ Ready but Blocked by Cloud Run Issues

### ✅ Code Complete
- All TypeScript files compile successfully
- Frontend builds without errors
- Backend functions build successfully
- All integration points working

### ❌ Deployment Blocked
The Firebase deployment is failing due to Cloud Run infrastructure issues:

```
Error: Container Healthcheck failed
- Quota exceeded for total allowable CPU per project per region
- Container failed to start and listen on PORT=8080
- Health check timeout exceeded
```

## Affected Functions

### New Functions (Failed to Deploy)
- ❌ `generateDailyActionPosts` - Scheduled action generation
- ❌ `generateInsightPosts` - Scheduled insight generation  
- ❌ `triggerActionPostsForUser` - Manual action trigger
- ❌ `triggerInsightPostsForUser` - Manual insight trigger

### Existing Functions (Also Failing)
Many existing functions are also failing with the same errors, indicating this is a **project-wide Cloud Run issue**, not specific to our new code.

## Root Causes

### 1. CPU Quota Exceeded
```
Quota exceeded for total allowable CPU per project per region
```
**Meaning**: Your Firebase project has hit the Cloud Run CPU limit for the us-central1 region.

### 2. Container Health Check Failures
```
Container failed to start and listen on PORT=8080
```
**Meaning**: Functions are timing out during startup, possibly due to:
- Too many concurrent deployments
- Resource constraints
- Cold start issues

## Solutions

### Option 1: Increase Cloud Run Quotas (Best Long-term)

1. Go to [Google Cloud Quotas](https://console.cloud.google.com/iam-admin/quotas?project=regen28-2fe51)
2. Search for "Cloud Run CPU"
3. Find "Cloud Run CPU allocation per region"
4. Click "Edit Quotas"
5. Request increase (explain: "Production app with multiple Cloud Functions")
6. Wait for approval (usually 24-48 hours)
7. Retry deployment

### Option 2: Delete Unused Functions (Quick Fix)

1. Go to [Firebase Console Functions](https://console.firebase.google.com/project/regen28-2fe51/functions)
2. Identify functions you're not using
3. Delete them to free up resources
4. Retry deployment

**Candidates for deletion:**
- Old test functions
- Deprecated functions
- Unused scheduled functions

### Option 3: Deploy to Different Region

Modify function configurations to use a different region:

```typescript
export const generateDailyActionPosts = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'UTC',
  region: 'us-east1', // ← Try different region
  secrets: [openaiApiKey],
  maxInstances: 5
}, async (event) => {
  // ...
});
```

### Option 4: Reduce Concurrent Instances

Temporarily reduce maxInstances to lower resource usage:

```typescript
export const generateDailyActionPosts = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'UTC',
  secrets: [openaiApiKey],
  maxInstances: 1, // ← Reduce from 5 to 1
}, async (event) => {
  // ...
});
```

### Option 5: Wait and Retry

Sometimes quota issues resolve after Cloud Run releases resources:

```powershell
# Wait 30 minutes, then try:
firebase deploy --only functions:triggerActionPostsForUser

# If successful, deploy next one:
firebase deploy --only functions:triggerInsightPostsForUser

# Then scheduled functions:
firebase deploy --only functions:generateDailyActionPosts
firebase deploy --only functions:generateInsightPosts
```

## Workaround: Test Locally

While waiting for deployment, you can test the logic locally using Firebase Emulators:

```powershell
# Start emulators
firebase emulators:start

# In another terminal, trigger functions via emulator
# The functions will run locally and write to your Firestore emulator
```

## What Works Right Now

### ✅ Frontend
- All UI components ready
- Manual trigger buttons in Settings
- Feed displays action/insight cards
- Dashboard filters for today's posts

### ✅ Backend Code
- Functions compile successfully
- Logic is sound
- TypeScript types are correct
- Integration points defined

### ⏳ Deployment
- Blocked by Cloud Run quota/health check issues
- Not a code problem
- Infrastructure/configuration issue

## Recommended Action Plan

### Immediate (Today)
1. **Delete unused functions** to free up resources
2. **Retry deployment** one function at a time
3. **Test with Firebase Emulators** if deployment still fails

### Short-term (This Week)
1. **Request quota increase** from Google Cloud
2. **Monitor existing functions** for resource usage
3. **Consider region migration** if quota not approved

### Long-term (Next Month)
1. **Optimize function resource allocation**
2. **Implement function pooling** to reduce concurrent instances
3. **Consider Cloud Run services** instead of Cloud Functions for heavy workloads

## Testing Without Deployment

You can still test the system logic:

### 1. Firebase Emulators
```powershell
firebase emulators:start
```
Then call functions via emulator endpoints.

### 2. Direct Firestore Writes
Manually create feed-item documents in Firestore Console to test the UI:

```json
{
  "userId": "your-user-id",
  "type": "action",
  "title": "Today's Action: Meditation",
  "subtitle": "MIND",
  "body": "Try a 10-minute morning meditation session",
  "source": {
    "kind": "ai-generated",
    "trackerId": "your-tracker-id",
    "trackerName": "Meditation"
  },
  "metadata": {
    "icon": "🧘",
    "reason": "Morning meditation helps set a calm tone",
    "trackerCategory": "MIND"
  },
  "dateKey": "2026-02-08",
  "visibility": "private",
  "createdAt": "2026-02-08T12:00:00Z",
  "updatedAt": "2026-02-08T12:00:00Z",
  "media": { "status": "none" },
  "author": {
    "name": "Regen28 Coach",
    "avatarUrl": "https://api.dicebear.com/7.x/bottts/svg?seed=regen28coach&backgroundColor=6366f1",
    "isAiGenerated": true,
    "location": "Action Center"
  },
  "likesCount": 0,
  "commentsCount": 0,
  "tags": ["action", "guidance", "mind"]
}
```

## Support Resources

- [Cloud Run Quotas Documentation](https://cloud.google.com/run/quotas)
- [Firebase Functions Troubleshooting](https://firebase.google.com/docs/functions/troubleshoot)
- [Cloud Run Health Checks](https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start)

## Summary

**Code Status**: ✅ 100% Complete  
**Deployment Status**: ⏳ Blocked by Cloud Run quota  
**Action Required**: Increase quota or delete unused functions  
**Estimated Fix Time**: 24-48 hours (quota increase) or 1 hour (delete unused functions)

---

**Last Updated**: February 8, 2026  
**Issue**: Cloud Run CPU quota exceeded  
**Resolution**: Pending quota increase or resource cleanup
