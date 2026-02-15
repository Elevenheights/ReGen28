# Regen28 - Wellness Tracking & AI Coaching App

A comprehensive wellness tracking application with AI-powered coaching, social-style feed, and personalized insights.

## Features

### 🏠 Social Feed
- Instagram-style post feed with full-width cards
- User profile avatars and AI coach avatars
- Swipeable square-format carousels for guidance and inspiration
- Today's Actions - Daily action items from AI coach
- Strategic Insights - Data-driven recommendations
- Daily Inspiration - Motivational quotes with navigation
- Like and comment on posts
- Visual stat cards and progress tracking
- Daily wellness summaries
- Tap-to-expand for detailed information

### 📊 Insights Dashboard
- Comprehensive analytics
- Mood tracking with visualizations
- Category performance (Mind, Body, Soul, Beauty)
- Streak tracking
- Weekly engagement charts

### 📝 Activity Tracking
- Custom trackers for habits and goals
- Frequency-aware tracking (daily, weekly, monthly)
- Progress photos
- Mood and energy logging
- AI-powered suggestions

### 📖 Journaling
- Daily journal entries
- Mood tracking
- AI-generated prompts
- Reflection exercises
- Sentiment analysis

### 🎯 Goals & Milestones
- Goal creation and tracking
- Milestone celebrations
- Progress visualization
- Achievement system

## Tech Stack

### Frontend
- **Framework**: Ionic 8 + Angular 20
- **UI**: Tailwind CSS + Ionic Components
- **State Management**: RxJS with caching
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Gestures**: Native touch/swipe support

### Backend
- **Functions**: Firebase Functions (Node 22)
- **Database**: Firestore
- **AI**: OpenAI GPT-4, Google Vertex AI (Imagen), **Google Gemini (`@google/generative-ai`)**
- **Video**: Remotion on Cloud Run
- **Image Processing**: Sharp

### Mobile
- **iOS**: Capacitor + Xcode
- **Android**: Capacitor + Android Studio
- **CI/CD**: Ionic Appflow

## Project Structure

```
regen28/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── feed/              # Feed components
│   │   │       ├── feed-list/
│   │   │       ├── feed-item-card/
│   │   │       ├── comments-modal/
│   │   │       └── cards/         # Specialized post cards
│   │   ├── pages/
│   │   │   └── tabs/
│   │   │       ├── dashboard/     # Feed tab (Home)
│   │   │       ├── insights/      # Analytics dashboard
│   │   │       ├── tracker/       # Activity tracking
│   │   │       ├── journal/       # Journaling
│   │   │       └── settings/      # Settings
│   │   ├── services/
│   │   │   ├── feed.service.ts
│   │   │   ├── media.service.ts
│   │   │   ├── activity.service.ts
│   │   │   ├── tracker.service.ts
│   │   │   └── statistics.service.ts
│   │   └── models/
│   │       ├── feed-item.interface.ts
│   │       ├── activity.interface.ts
│   │       └── tracker.interface.ts
│   └── assets/
├── functions/
│   ├── src/
│   │   ├── feed/
│   │   │   ├── feed-items.ts      # Feed generation
│   │   │   ├── feed-jobs.ts       # Media generation
│   │   │   ├── interactions.ts    # Likes & comments
│   │   │   ├── wrapped-scheduler.ts
│   │   │   └── wrapped-jobs.ts
│   │   ├── openai.service.ts
│   │   ├── user-management.ts
│   │   └── statistics-functions.ts
│   └── services/
│       └── remotion-renderer/     # Video generation service
├── ios/
│   └── App/
├── android/
│   └── app/
├── docs/
│   ├── BACKEND_INFRASTRUCTURE.md
│   ├── ACTION_INSIGHT_FEED_SYSTEM.md
│   ├── FEED_IMPLEMENTATION.md
│   └── IOS_APPFLOW_TESTERS.md
├── COMMANDS.md
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

## Documentation

- **[Backend Infrastructure](docs/BACKEND_INFRASTRUCTURE.md)**: Cloud Functions setup, initialization, and deployment directly from the source.
- **[Action & Insight System](docs/ACTION_INSIGHT_FEED_SYSTEM.md)**: Detailed architecture of the personalized coaching feed.
- **[Feed Implementation](docs/FEED_IMPLEMENTATION.md)**: Overview of the social feed, post types, and frontend components.
- **[iOS Testing](docs/IOS_APPFLOW_TESTERS.md)**: Guide for iOS testers using Appflow.
- **[Common Commands](COMMANDS.md)**: Quick reference for deployment and development commands.

## Getting Started

### Prerequisites
- Node.js 22+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Ionic CLI (`npm install -g @ionic/cli`)
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd regen28
npm install
```

2. **Install Functions Dependencies**
```bash
cd functions
npm install
cd ..
```

3. **Configure Firebase**
```bash
firebase login
firebase use regen28-2fe51
```

4. **Set Environment Variables**
Create `.env` file:
```
FIREBASE_API_KEY=your_key
FIREBASE_PROJECT_ID=regen28-2fe51
```

5. **Deploy Backend**
```bash
cd functions
npm run build
firebase deploy --only functions
firebase deploy --only storage
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Development

**Run Locally**
```bash
ionic serve
```

**Run on iOS**
```bash
ionic cap sync ios
ionic cap open ios
```

**Run on Android**
```bash
ionic cap sync android
ionic cap open android
```

**Firebase Emulators**
```bash
firebase emulators:start
```

## Feed Implementation Details

### Post Types

#### 1. Tracker Entry
- **Visual**: Full-width gradient background with icon and value
- **Colors**: Category-based (Mind=Indigo, Body=Emerald, Soul=Amber, Beauty=Pink)
- **Data Source**: `activities` collection (type: `tracker_entry`)
- **Author**: User avatar with display name

#### 2. Daily Wellness Check
- **Visual**: Purple gradient with metrics
- **Author**: Regen28 Coach (with bot avatar)
- **Data Source**: `user-daily-stats` collection
- **Frequency**: Once per day

#### 3. Today's Actions
- **Visual**: Square carousel (1:1 aspect ratio) with emerald gradient
- **Author**: Regen28 Coach @ Action Center
- **Data Source**: `tracker-specific-suggestions` collection
- **Content**: AI-generated daily action items
- **Features**: Swipe navigation, tap-to-expand for details, tracker name header
- **Metadata**: Icon, reason, tracker context

#### 4. Strategic Insights
- **Visual**: Square carousel (1:1 aspect ratio) with blue gradient
- **Author**: Regen28 Coach @ Analytics Lab
- **Data Source**: `tracker-specific-suggestions` collection
- **Content**: AI-generated insights based on tracking patterns
- **Features**: Swipe navigation, tap-to-expand for details, tracker name header
- **Metadata**: Type, data point, reason

#### 5. Daily Inspiration
- **Visual**: Square carousel (1:1 aspect ratio) with amber/orange gradient
- **Author**: Regen28 Coach @ Wisdom Corner
- **Data Source**: Motivational quotes from `tracker-specific-suggestions`
- **Content**: Inspirational quotes with author attribution
- **Features**: Swipe navigation, fade transitions, dot indicators

#### 6. AI Motivational & Contextual Posts
- **Visual**: High-fidelity AI-generated images (1:1 aspect ratio)
- **Author**: Nano Banana (AI Coach)
- **Data Source**: Generated by Gemini Pro/Standard via Cloud Functions
- **Content**:
    - **Motivational**: Personalized scenes (uses user reference photos if available)
    - **Contextual**: Visual metaphors for current streaks and activity
- **Features**: Dynamic likeness (Pro model), smart fallback for generic characters

### Social Interactions

#### Likes
- **Backend**: `functions/src/feed/interactions.ts` → `toggleLike`
- **Storage**: `feed-likes` collection
- **UI**: Optimistic updates (instant feedback)
- **Icon**: Heart (outline → filled red)

#### Comments
- **Backend**: `functions/src/feed/interactions.ts` → `addComment`, `getComments`
- **Storage**: `feed-comments` collection
- **UI**: Modal with comment list and input field
- **Features**: Pagination, real-time updates

### Media Generation

#### Stat Cards (SVG → PNG)
1. Generate SVG template with data
2. Convert to PNG using `sharp`
3. Upload to `feed-media/{userId}/cards/`
4. Update feed item with URL

#### AI Images (Vertex AI)
1. Check user consent
2. Verify rate limit (5/day)
3. Call Vertex AI Imagen API
4. Upload to `ai-media/{userId}/`
5. Add AI metadata to post

#### Wrapped Videos (Remotion)
1. Scheduler creates jobs (weekly)
2. Worker calls Cloud Run service
3. Remotion renders MP4
4. Upload to `wrapped-videos/{userId}/`
5. Generate thumbnail

## Configuration

### Firebase Functions Environment
```bash
firebase functions:config:set openai.key="sk-..."
firebase functions:config:set google.gemini_key="AIza..."
firebase functions:config:set remotion.url="https://..."
```

### App Configuration
**Location**: `capacitor.config.json`
```json
{
  "appId": "com.regen28labs",
  "appName": "Regen28",
  "webDir": "www"
}
```

## Deployment

### iOS (Appflow)
1. Push to `main` branch
2. Appflow triggers build automatically
3. Uses `Eleven_Heights_Dev.mobileprovision`
4. Code signing: Apple Development certificate

### Android
```bash
ionic cap sync android
cd android
./gradlew assembleRelease
```

### Web
```bash
ionic build --prod
firebase deploy --only hosting
```

## API Documentation

### Feed Endpoints

#### Get Feed
```typescript
feedService.getFeed(limit: number): Observable<FeedItem[]>
```

#### Toggle Like
```typescript
feedService.toggleLike(feedItemId: string): Observable<{likesCount: number, hasLiked: boolean}>
```

#### Add Comment
```typescript
feedService.addComment(feedItemId: string, text: string): Observable<FeedComment>
```

#### Get Comments
```typescript
feedService.getComments(feedItemId: string, limit?: number): Observable<FeedComment[]>
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact: support@regen28.com
