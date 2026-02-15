# Feed Generation Enhancement - Feb 11, 2026

## Overview
Enhanced the motivational and contextual post generation system to use comprehensive user context instead of generic prompts. Posts are now highly personalized based on actual user data.

## Changes Made

### 1. Motivational Posts (`generateMotivationalPostsLogic`)

#### What It Now Considers:
- ✅ **Active Trackers**: Name, category, frequency of all active trackers
- ✅ **Active Goals**: Title, category, progress percentage
- ✅ **Recent Stats** (last 7 days):
  - Overall streak count
  - Average mood (calculated from daily stats)
  - Total activities logged
  - Top category (most active area)
- ✅ **User Profile**:
  - Age (calculated from birthday)
  - Gender
  - Wellness goals from onboarding
  - Focus areas
- ✅ **Reference Images**: Properly uses `referenceImageFace` or `referenceImageBody` when Pro model is enabled
- ✅ **Style Preference**: Uses `user.postStyle` (realistic/illustrated)
- ✅ **Model Selection**: Respects `user.preferences.devSettings.nanoModelType` (standard/pro)

#### Enhanced Prompt Structure:
```
**User Profile:**
- Age: [calculated age]
- Gender: [from profile]
- Style preference: [realistic/illustrated]
- Wellness goals: [from onboarding]
- Focus areas: [from onboarding]

**Current Activity:**
- Active trackers: [list with category and frequency]
- Goals: [list with progress %]
- Current streak: X days. Recent mood: Y/10. Most active in: [category]

**Character Instructions:**
[Uses reference image if Pro model enabled, otherwise describes age-appropriate character]

**Requirements:**
1. Highly specific to their journey
2. Reference actual trackers or goals
3. Empowering, aspirational scenes
4. Match visual style preference
5. Personal and relevant to current progress
```

#### Stored Context:
Each post now stores metadata:
```typescript
context: {
  activeTrackerCount: number,
  activeGoalCount: number,
  currentStreak: number,
  topCategory: string
}
```

---

### 2. Contextual Posts (`generateContextualPostsLogic`)

#### What It Now Considers:
- ✅ **Recent Stats** (last 7 days):
  - Overall streak
  - Journal streak
  - Tracker streak
  - Total activities
  - Average mood
  - Wellness score
  - Category breakdown
  - Milestone progress
- ✅ **Recent Achievements**: Last 5 earned achievements
- ✅ **Active Trackers**: For context about what they're working on
- ✅ **Notable Milestones**:
  - 7+ day overall streak
  - 5+ day journaling streak
  - 5+ day tracking streak

#### Enhanced Prompt Structure:
```
**User's Recent Activity:**
- Recent achievements: [list of achievement titles]
- Active in: [list of tracker names]
- Milestones: [specific streak achievements]
- Wellness score: X/100
- Average mood: Y/10
- Total activities logged: Z

**Requirements:**
1. Visual metaphors for specific achievements
2. Reference actual numbers (e.g., "7-day streak" → 7 stepping stones)
3. Celebratory and empowering
4. Symbolic imagery for progress
5. Grounded in real achievements
```

#### Stored Context:
```typescript
context: {
  overallStreak: number,
  journalStreak: number,
  trackerStreak: number,
  wellnessScore: number,
  recentAchievementCount: number
}
```

---

## New Helper Function

### `calculateAge(birthday: string): number`
- Calculates user's age from birthday string
- Accounts for month and day to get accurate age
- Used in motivational post generation for age-appropriate character descriptions

---

## Benefits

### Before:
- Generic prompts: "The user is on a self-improvement journey"
- No personalization
- Same type of images for all users
- No connection to actual progress

### After:
- **Highly personalized**: References specific trackers, goals, and achievements
- **Data-driven**: Uses actual stats, streaks, and mood data
- **Context-aware**: Knows what the user is working on and celebrating
- **Settings-respecting**: Uses reference images when enabled, respects style preferences
- **Achievement-focused**: Contextual posts celebrate real milestones

---

## Example Scenarios

### User A: 
- 25-year-old woman
- Tracking meditation (daily), yoga (3x/week), journaling (daily)
- 14-day overall streak
- Goal: "Reduce stress and anxiety" (60% complete)
- Has reference face photo, Pro model enabled

**Generated Prompt Might Be:**
"A 25-year-old woman in a peaceful meditation pose on a yoga mat at sunrise, surrounded by 14 glowing stepping stones representing her journey, with a serene expression showing inner peace and progress toward her stress reduction goal"

### User B:
- 40-year-old man
- Tracking gym workouts (4x/week), meal prep (weekly)
- 7-day streak
- Goal: "Build muscle and improve nutrition" (30% complete)
- No reference photo, Standard model

**Generated Prompt Might Be:**
"A determined 40-year-old man preparing healthy meals in a modern kitchen, with 7 achievement badges floating above, symbolizing his first week of consistency on his muscle-building and nutrition journey"

---

## Deployment Notes

### Required Firestore Indexes:
```
user-daily-stats: userId, date (desc)
achievements: userId, earnedAt (desc)
trackers: userId, isActive
goals: userId, status
```

### Memory Requirements:
- Motivational posts: 512MiB (due to Gemini SDK + OpenAI)
- Contextual posts: 512MiB

### Testing:
Use Developer Settings in the app to manually trigger:
- "Generate Motivational Posts" → `generateDailyMotivationalPostsCallable`
- "Generate Contextual Posts" → `generateDailyContextualPostsCallable`

---

## Next Steps (Optional Enhancements)

1. **Rate Limiting**: Add daily limit per user (currently generates 3 of each type)
2. **Duplicate Prevention**: Check recent posts to avoid repetitive themes
3. **Time-of-Day Context**: Morning posts vs evening posts
4. **Seasonal Themes**: Incorporate time of year
5. **Social Context**: If user has friends, reference community progress
6. **A/B Testing**: Track which types of posts get more engagement

---

## Files Modified

- `functions/src/feed/feed-generation.ts` (225 lines added/modified)
  - Enhanced `generateMotivationalPostsLogic()` function
  - Enhanced `generateContextualPostsLogic()` function
  - Added `calculateAge()` helper function

---

# High Fidelity & Performance Update - Feb 12, 2026

## Overview
Addressed image quality issues by enabling OpenAI's `input_fidelity: "high"` mode and improved system reliability with parallel execution and smart fallbacks.

## Changes Made

### 1. High Fidelity Image Generation
- **OpenAI GPT-1.5**: Enabled `input_fidelity: "high"` which significantly improves face and body preservation from reference photos.
- **Protocol Change**: Switched from `b64_json` response format to URL-based fetching because `input_fidelity` is incompatible with direct base64 responses in the OpenAI API.
- **Reference Handling**: Now fetches user face/body photos as high-quality Buffers once and passes them to the AI models, ensuring consistent character likeness.

### 2. Performance & Reliability
- **Parallel Execution**: Refactored generation logic to trigger all 3 image requests simultaneously using `Promise.all`.
  - *Result*: 3x faster generation speed.
- **Extended Timeouts**: Increased Cloud Function timeouts from 300s to **540s** (9 minutes) to prevent `deadline-exceeded` errors during high-load parallel processing.
- **Smart Fallback**: 
  - If OpenAI fails, automatically falls back to Gemini (Nano Banana) via Vertex AI.
  - If Gemini fails, (in future) could fall back to OpenAI (currently primary).
  - Crucially, **reference images are preserved** across fallbacks, so the user's likeness is never lost even if the primary provider goes down.

### 3. Gemini Multi-Reference
- Updated `GeminiImageService` to accept multiple reference images (Face + Body) simultaneously, matching the OpenAI implementation.

## Deployment Notes
- **Timeout**: Ensure `callFunction` in the frontend also has a matching timeout (e.g., `{ timeout: 540000 }`).
- **Permissions**: Verify `allUsers` invoker permission if you see CORS errors on the new high-timeout functions.
