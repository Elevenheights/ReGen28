# Firebase Functions Consolidation Plan

## Current Problem

**38 Cloud Run services** consuming CPU quota, with **35 in failed state**

### Current Status:
- ✅ Healthy: 3 functions (generatedailyactionposts, processfeedmediajobs, triggerinsightpostsforuser)
- ❌ Failed: 35 functions
- 💰 Cost: 38 CPUs allocated (exceeds quota)

## Intelligent Consolidation Strategy

### Group 1: AI Content Generation (Consolidate to 1 function)
**Current**: 6 separate functions
- `getTrackerSpecificSuggestions` ❌
- `getDailyJournalPrompt` ❌
- `getReflectionPrompts` ❌
- `generateDailyActionPosts` ✅
- `generateInsightPosts` ❌
- `getTrackerRecommendations` ✅

**Proposed**: `aiContentGenerator` (1 function)
```typescript
export const aiContentGenerator = onCall({
  timeoutSeconds: 540,
  memory: '512MiB',
  cpu: 1
}, async (request) => {
  const { type, ...params } = request.data;
  
  switch(type) {
    case 'tracker-suggestions': return getTrackerSuggestions(params);
    case 'journal-prompt': return getJournalPrompt(params);
    case 'reflection-prompts': return getReflectionPrompts(params);
    case 'tracker-recommendations': return getTrackerRecommendations(params);
    case 'action-posts': return generateActionPosts(params);
    case 'insight-posts': return generateInsightPosts(params);
  }
});
```
**Savings**: 6 → 1 = **-5 functions**

### Group 2: Job Processors (Consolidate to 1 function)
**Current**: 4 separate functions
- `processSuggestionJobs` ❌
- `processJournalPromptJobs` ❌
- `processFeedMediaJobs` ✅
- `processWrappedVideoJobs` ❌

**Proposed**: `jobProcessor` (1 function)
```typescript
export const jobProcessor = onCall({
  timeoutSeconds: 540,
  memory: '1GiB',
  cpu: 1
}, async (request) => {
  const { jobType, ...params } = request.data;
  
  switch(jobType) {
    case 'suggestions': return processSuggestionJobs(params);
    case 'journal-prompts': return processJournalPromptJobs(params);
    case 'feed-media': return processFeedMediaJobs(params);
    case 'wrapped-videos': return processWrappedVideoJobs(params);
  }
});
```
**Savings**: 4 → 1 = **-3 functions**

### Group 3: Schedulers (Consolidate to 1 function)
**Current**: 4 separate schedulers
- `queueDailyTrackerSuggestions` ❌
- `queueDailyJournalPrompts` ❌
- `checkExpiredTrackers` ❌
- `checkExpiredTrials` ❌

**Proposed**: `dailyScheduler` (1 scheduled function)
```typescript
export const dailyScheduler = onSchedule({
  schedule: '0 6 * * *', // 6 AM UTC
  timeZone: 'UTC',
  timeoutSeconds: 540,
  memory: '512MiB',
  cpu: 1
}, async (event) => {
  await Promise.all([
    queueTrackerSuggestions(),
    queueJournalPrompts(),
    checkExpiredTrackers(),
    checkExpiredTrials()
  ]);
});
```
**Savings**: 4 → 1 = **-3 functions**

### Group 4: Firestore Triggers (Keep Separate but Fix)
**Current**: 5 triggers (all failing)
- `onTrackerEntryCreated` ❌
- `onTrackerEntryCreatedStats` ❌
- `onJournalEntryWritten` ❌
- `onActivityCreated` ❌
- `onSuggestionJobCreated` ❌
- `onActivityCreatedFeedTrigger` ❌
- `onFeedMediaJobCreated` ❌

**Action**: Keep separate but add proper configuration
```typescript
export const onTrackerEntryCreated = onDocumentCreated({
  document: 'tracker-entries/{entryId}',
  timeoutSeconds: 60,
  memory: '256MiB',
  cpu: 1
}, async (event) => {
  // ...
});
```
**Savings**: None, but fix health checks

### Group 5: Cleanup Functions (Consolidate to 1 function)
**Current**: 2 functions
- `cleanupDuplicateTrackers` ❌
- `cleanupOldSuggestions` ❌

**Proposed**: `maintenanceCleanup` (1 scheduled function)
```typescript
export const maintenanceCleanup = onSchedule({
  schedule: '0 2 * * *', // 2 AM UTC daily
  timeZone: 'UTC',
  timeoutSeconds: 300,
  memory: '256MiB',
  cpu: 1
}, async (event) => {
  await Promise.all([
    cleanupDuplicateTrackers(),
    cleanupOldSuggestions()
  ]);
});
```
**Savings**: 2 → 1 = **-1 function**

### Group 6: User Management (Keep as is)
**Current**: 2 functions
- `completeUserOnboarding` ✅
- `updateUserStats` ❌

**Action**: Keep separate (critical user flows)

### Group 7: Statistics (Consolidate to 2 functions)
**Current**: 4 functions
- `calculateAllDailyStats` ❌
- `getStatistics` ❌
- `triggerStatsCalculation` ❌
- `backfillUserStats` ❌

**Proposed**: 
1. `statsCalculator` (scheduled daily)
2. `statsApi` (on-demand queries)

**Savings**: 4 → 2 = **-2 functions**

### Group 8: Feed Interactions (Consolidate to 1 function)
**Current**: 3 functions (all failing)
- `toggleLike` ❌
- `addComment` ❌
- `getComments` ❌

**Proposed**: `feedInteractions` (1 function)
```typescript
export const feedInteractions = onCall({
  timeoutSeconds: 60,
  memory: '256MiB',
  cpu: 1
}, async (request) => {
  const { action, ...params } = request.data;
  
  switch(action) {
    case 'toggle-like': return toggleLike(params);
    case 'add-comment': return addComment(params);
    case 'get-comments': return getComments(params);
  }
});
```
**Savings**: 3 → 1 = **-2 functions**

### Group 9: Delete Unused
**Current**: Functions not needed
- `seedUserTestData` ❌ (test data only)
- `scheduleWeeklyWrapped` ❌ (wrapped videos - future feature)
- `processWrappedVideoJobs` ❌ (wrapped videos - future feature)
- `updateUserSubscriptionStatus` ❌ (subscriptions not implemented)
- `logTrackerEntry` ❌ (redundant - done client-side)

**Action**: Delete completely
**Savings**: **-5 functions**

## Consolidation Summary

### Before: 38 Functions
1. AI Content: 6 functions
2. Job Processors: 4 functions
3. Schedulers: 4 functions
4. Firestore Triggers: 7 functions
5. Cleanup: 2 functions
6. User Management: 2 functions
7. Statistics: 4 functions
8. Feed Interactions: 3 functions
9. Unused: 5 functions
10. Misc: 1 function (getTrackerRecommendations in index.ts)

### After: ~15 Functions (60% reduction!)
1. `aiContentGenerator` - All AI content
2. `jobProcessor` - All job processing
3. `dailyScheduler` - Daily maintenance tasks
4. `maintenanceCleanup` - Cleanup tasks
5. `feedInteractions` - Like/comment/get
6. `completeUserOnboarding` - User onboarding
7. `updateUserStats` - User stats
8. `statsCalculator` - Daily stats calculation
9. `statsApi` - Stats queries
10. `onTrackerEntryCreated` - Firestore trigger
11. `onJournalEntryWritten` - Firestore trigger
12. `onActivityCreated` - Firestore trigger
13. `generateDailyActionPosts` - Already deployed ✅
14. `triggerActionPostsForUser` - Manual trigger
15. `triggerInsightPostsForUser` - Already deployed ✅

**Total Reduction**: 38 → 15 = **-23 functions (60% reduction!)**

## Implementation Priority

### Phase 1: Delete Unused (Immediate)
Delete these 5 functions right now:
```bash
firebase functions:delete seedUserTestData scheduleWeeklyWrapped processWrappedVideoJobs updateUserSubscriptionStatus logTrackerEntry --region us-central1 --force
```
**Impact**: Free up 5 CPUs immediately

### Phase 2: Consolidate AI Content (High Priority)
Create `aiContentGenerator` and migrate all AI functions
**Impact**: Free up 5 more CPUs

### Phase 3: Consolidate Job Processors (High Priority)
Create `jobProcessor` and migrate all job functions
**Impact**: Free up 3 more CPUs

### Phase 4: Consolidate Schedulers (Medium Priority)
Create `dailyScheduler` for all scheduled tasks
**Impact**: Free up 3 more CPUs

### Phase 5: Consolidate Feed Interactions (Medium Priority)
Create `feedInteractions` for all social features
**Impact**: Free up 2 more CPUs

### Phase 6: Consolidate Statistics (Low Priority)
Combine stats functions
**Impact**: Free up 2 more CPUs

## Benefits

### Resource Efficiency
- **60% fewer functions** = 60% less CPU quota
- **Faster deployments** (fewer services to update)
- **Lower costs** (fewer Cloud Run services)

### Code Maintainability
- **Single entry point** for related operations
- **Easier debugging** (one place to check)
- **Consistent configuration** (timeout, memory, CPU)

### Deployment Reliability
- **Fewer health checks** to pass
- **Less quota pressure**
- **More reliable deployments**

## Next Steps

1. **Immediate**: Delete 5 unused functions
2. **This week**: Consolidate AI content functions
3. **Next week**: Consolidate job processors
4. **Ongoing**: Consolidate remaining groups

## Testing Plan

After each consolidation:
1. Test the consolidated function with all operation types
2. Verify existing functionality works
3. Monitor performance and errors
4. Deploy to production

---

**Estimated Time to Complete**: 2-3 days  
**Expected Result**: 15 lean, efficient functions  
**CPU Savings**: 23 CPUs freed up
