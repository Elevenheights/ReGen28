# Project Checklist: ReGen28 Wellness App (Ionic + Firebase)

This checklist provides a comprehensive roadmap for building the ReGen28 wellness mobile app using Ionic and Firebase. It covers all phases of development, from initial setup to deployment and post-launch maintenance.

---

## Phase 0: Architecture Alignment 🚧 IN PROGRESS

### 0.1. System Architecture & Data Flow
- [x] Defined high-level architecture:
    - Ionic + Angular client (Capacitor for native iOS / Android builds)
    - Firebase backend (Authentication, Cloud Firestore, Cloud Functions, Storage, Hosting)
    - Angular service layer between UI components and Firebase SDK
    - Central **Dashboard** page as the hub that aggregates data from Trackers, Journal, Goals, and Settings
    - Unidirectional data flow → Services → Components → UI for predictable state management
- [x] Identified primary data models (User, Tracker, TrackerEntry, MoodEntry, JournalEntry, Goal, Settings)
- [x] Documented data interactions and relationships between pages and services
- [x] Created `generate_architecture_diagram.py` to visualize components & data flow
- [ ] Run script to export the latest `regen28_architecture.png`
- [ ] Embed diagram in project docs (README / wiki) and keep updated when architecture changes

### 0.2. Next Steps
- [ ] Review architecture with team and refine if new services / models are required
- [ ] Finalize naming conventions for Firestore collections, Cloud Function triggers, and security rules before Firebase implementation

---

## Phase 1: Project Setup & Foundation ✅ COMPLETED

### 1.1. Environment & Tooling ✅
- [x] Install Node.js and npm/yarn (Upgraded from v18.20.4 to v22.17.0)
- [x] Install the Ionic CLI (`npm install -g @ionic/cli`)
- [x] Set up a new Ionic project (`ionic start regen28-app tabs --type=angular --capacitor`)
- [x] Install Capacitor (included with tabs template)
- [x] Set up workspace structure in `/c%3A/Users/miggl/Documents/Development/regen28`

### 1.2. Firebase Setup 🚧 PLANNED
- [ ] Create a new Firebase project in the Firebase Console
- [ ] Register your iOS and Android apps with the Firebase project
- [ ] Download and add `GoogleService-Info.plist` (for iOS) and `google-services.json` (for Android) to the project
- [ ] Install the Firebase SDK (`npm install firebase @angular/fire`)
- [ ] Initialize Firebase in your Ionic app (`app.module.ts`)

### 1.3. Project Structure & Styling ✅
- [x] Create a well-organized folder structure (tabs-based structure with 4 main pages)
- [x] Implement the shared styling system:
    - [x] Integrated existing `shared-styles.css` color palette and design system
    - [x] Set up Tailwind CSS v3 with custom color configuration
    - [x] Created comprehensive CSS custom properties for neutral, primary, secondary, and success colors
- [x] Set up PostCSS configuration for Tailwind integration
- [x] Ensure all pages are using the shared styling system with exact pixel-perfect matching

### 1.4. Basic App Shell ✅
- [x] Create the main app component with bottom navigation bar (4 tabs: Dashboard, Tracker, Journal, Settings)
- [x] Implement routing for all main pages (Dashboard=tab1, Tracker=tab3, Journal=tab2, Settings=tab4)
- [x] Ensure the app has consistent look and feel across all pages with Font Awesome icons and Inter font

---

## Phase 2: UI Implementation & Design System ✅ COMPLETED

### 2.1. Design System Implementation ✅
- [x] Integrated Font Awesome 6.4.0 via CDN for consistent iconography
- [x] Implemented Inter font family for typography
- [x] Created comprehensive color palette matching sample designs:
  - [x] Neutral colors (#f9fafb to #111827)
  - [x] Blue primary colors (#eff6ff to #1e3a8a) 
  - [x] Purple secondary colors (#f5f3ff to #4c1d95)
  - [x] Green success colors (#ecfdf5 to #064e3b)
- [x] Configured precise spacing system with Tailwind utilities

### 2.2. Page Implementation ✅
- [x] **Dashboard Page** - Recreated to exactly match `dashboard.html`:
  - [x] Profile header with greeting and journey day count
  - [x] Wellness progress card with 65% completion bar
  - [x] Quick stats grid (Mindfulness sessions, Journal entries)
  - [x] Recent activity section with icon circles and timestamps
  - [x] Today's intentions checklist
  - [x] Quick actions buttons (Log Mood, Breathe)

- [x] **Tracker Page** - Recreated to exactly match `tracker-management.html`:
  - [x] Active trackers with color-coded progress bars (Daily Mood 75%, Gratitude 60%, Meditation 90%)
  - [x] Weekly summary statistics (18 sessions, 15 day streak)
  - [x] Suggested trackers section (Sleep Quality, Energy Levels)
  - [x] Recently completed challenges with trophy icons

- [x] **Journal Page** - Recreated to exactly match `journal.html`:
  - [x] Reflection journey statistics (23 entries, 7 this week, 15 day streak)
  - [x] Write new entry button
  - [x] Reflection prompts section with heart, leaf, and brain icons
  - [x] Recent entries with mood/energy metadata
  - [x] Weekly mood tracker with emoji faces

- [x] **Settings Page** - Recreated to exactly match `settings.html`:
  - [x] Profile section with avatar and journey stats
  - [x] Account management (Edit Profile, Privacy & Security, Premium Plan)
  - [x] Wellness preferences with toggle switches (Daily Reminders, Dark Mode)
  - [x] Data & Privacy section (Backup, Export, Encryption)
  - [x] Support & Resources section
  - [x] Sign out functionality

### 2.3. Responsive Design & Spacing ✅
- [x] Fixed header spacing to match sample exactly (compact py-3 padding)
- [x] Implemented proper card spacing with p-4 and p-3 variations
- [x] Fixed Recent Activity alignment with items-start
- [x] Corrected button icon spacing with mb-2
- [x] Ensured tab bar matches sample with py-2 padding and proper icon/label sizing
- [x] Applied tight line-heights throughout for compact, professional appearance

---

## Phase 3: Technical Integration ✅

### 3.1. Tailwind CSS Integration ✅
- [x] Installed Tailwind CSS v3.4.0 with PostCSS and Autoprefixer
- [x] Created `tailwind.config.js` with custom color palette
- [x] Configured `postcss.config.js` for proper plugin integration
- [x] Disabled Tailwind preflight to avoid conflicts with Ionic
- [x] Added comprehensive CSS utility classes for spacing, typography, and layout

### 3.2. Component Architecture ✅
- [x] Removed Ionic-specific styling (ion-header, ion-toolbar wrappers)
- [x] Implemented clean header elements with exact sample structure
- [x] Used semantic HTML with proper main, section, and article tags
- [x] Applied consistent component patterns across all pages
- [x] Ensured proper TypeScript component imports for Ionic elements

### 3.3. Styling System ✅
- [x] Created comprehensive global.scss with:
  - [x] CSS custom properties for all color variables
  - [x] Font imports and font-family overrides
  - [x] Component-specific spacing fixes
  - [x] Tab bar styling matching sample navigation
  - [x] Utility class definitions with !important overrides
  - [x] Text sizing definitions (text-xs through text-xl)

---

## Phase 4: Core Functionality & Data Models 🚧 IN PROGRESS

### 4.1. Firebase Setup & Authentication 🔄 NEXT
- [ ] Create Firebase project and configure authentication
- [ ] Install Firebase dependencies (`npm install firebase @angular/fire`)
- [ ] Configure Firebase in `src/environments/environment.ts`
- [ ] Set up AngularFire modules in app.module.ts
- [ ] Enable Email/Password authentication in Firebase Console
- [ ] Enable Google sign-in provider
- [ ] Create AuthService with login/logout/register methods
- [ ] Implement auth guards for protected routes
- [ ] Add loading states and error handling for auth

### 4.2. Data Models & Interfaces 📋 NEXT
Create TypeScript interfaces for all data structures:

#### 4.2.1. User Model
- [ ] Create `src/app/models/user.interface.ts`:
  - [ ] User profile (id, email, displayName, photoURL)
  - [ ] Wellness journey data (joinDate, currentDay, streakCount)
  - [ ] Preferences (notifications, darkMode, language)
  - [ ] Stats (totalEntries, totalSessions, completedTrackers)

#### 4.2.2. Tracker Models
- [ ] Create `src/app/models/tracker.interface.ts`:
  - [ ] **TrackerCategory enum**: 
    - MIND (meditation, focus, learning, mental exercises)
    - BODY (exercise, sleep, nutrition, physical health)
    - SOUL (gratitude, prayer, connection, spiritual practices) 
    - BEAUTY (skincare, grooming, self-care, beauty routines)
    - MOOD (universal daily mood tracking)
    - CUSTOM (user-defined tracker types)
  - [ ] **Tracker interface**: (id, name, category, color, icon, target, unit, isActive, createdDate)
  - [ ] **TrackerEntry interface**: (id, trackerId, userId, date, value, mood?, energy?, notes, photos[], location?, weather?, tags[], reminderTriggered?, deviceInfo?, duration?, intensity?, quality?, socialContext?, attachments[], createdAt, updatedAt)
    - **Core Metadata**: value (primary metric), mood (1-5), energy (1-5), notes (free text)
    - **Media & Context**: photos[] (URLs), attachments[] (files/audio), location (GPS), weather (temp/conditions)
    - **Categorization**: tags[] (custom labels), socialContext (alone/with-others/group)
    - **Quality Metrics**: duration (actual time spent), intensity (1-10), quality (1-10 satisfaction)
    - **System Data**: reminderTriggered (bool), deviceInfo (mobile/web), createdAt/updatedAt (timestamps)
  - [ ] **TrackerStats interface**: (streakDays, completionRate, weeklyCount, monthlyAverage)
  - [ ] **MoodEntry interface**: (id, userId, date, moodLevel, energy, notes, relatedTrackers[])

#### 4.2.3. Default Tracker Templates
- [ ] Create `src/app/data/default-trackers.ts`:
  - [ ] **Mind Trackers**:
    - Meditation (minutes per day, target: 10)
    - Focus Sessions (sessions per day, target: 3)
    - Learning Time (minutes per day, target: 30)
    - Mindfulness Practice (sessions per week, target: 7)
  - [ ] **Body Trackers**:
    - Exercise (minutes per day, target: 30)
    - Sleep Quality (hours per night, target: 8)
    - Water Intake (glasses per day, target: 8)
    - Steps (count per day, target: 10000)
  - [ ] **Soul Trackers**:
    - Gratitude Practice (entries per day, target: 3)
    - Prayer/Meditation (minutes per day, target: 15)
    - Social Connection (interactions per day, target: 2)
    - Acts of Kindness (count per week, target: 5)
  - [ ] **Beauty Trackers**:
    - Skincare Routine (routines per day, target: 2)
    - Self-Care Time (minutes per day, target: 20)
    - Beauty Practice (sessions per week, target: 3)
    - Grooming Time (minutes per day, target: 15)
  - [ ] **Mood Tracker** (universal):
    - Daily Mood (1-5 scale, target: daily)
    - Energy Level (1-5 scale, target: daily)
    - Overall Wellness (1-10 scale, target: daily)
  - [ ] **Quick Setup Function**:
    - Provide a utility function `initializeDefaultTrackers(userId)` that seeds all above trackers for a newly-registered user in Firestore
    - Ensure idempotency (skip if trackers already exist)
    - Expose via `TrackerService` for onboarding flow

#### 4.2.4. Journal Models
- [ ] Create `src/app/models/journal.interface.ts`:
  - [ ] JournalEntry interface (id, userId, date, title, content, mood, energy, tags)
  - [ ] JournalPrompt interface (id, text, icon, category)
  - [ ] JournalStats interface (totalEntries, weeklyCount, streakDays, avgMood)

#### 4.2.5. Goals Models
- [ ] Create `src/app/models/goals.interface.ts`:
  - [ ] **GoalCategory enum**: 
    - CAREER (job, skills, professional development)
    - RELATIONSHIPS (family, friends, social connections)
    - PERSONAL (hobbies, interests, self-improvement)
    - FINANCIAL (major purchases, investments, debt payoff)
    - HEALTH (long-term health goals, major lifestyle changes)
    - EDUCATION (courses, degrees, certifications)
    - LIFESTYLE (travel, experiences, major life changes)
  - [ ] **Goal interface**: (id, title, description, category, targetDate, priority, status, progress)
  - [ ] **GoalMilestone interface**: (id, goalId, title, description, dueDate, isCompleted, completedDate)
  - [ ] **GoalProgress interface**: (id, goalId, date, progressPercent, notes, attachments)

#### 4.2.6. Settings Models
- [ ] Create `src/app/models/settings.interface.ts`:
  - [ ] UserPreferences interface (notifications, darkMode, language, reminderTime)
  - [ ] NotificationSettings interface (dailyReminders, weeklyReports, milestones)
  - [ ] PrivacySettings interface (dataSharing, analytics, backupEnabled)

### 4.3. Service Layer Development 📋 NEXT

#### 4.3.1. Core Services
- [ ] Create `src/app/services/auth.service.ts`:
  - [ ] User authentication (login, register, logout)
  - [ ] User profile management
  - [ ] Auth state management with BehaviorSubject
  - [ ] Password reset functionality
  - [ ] Google sign-in integration

- [ ] Create `src/app/services/user.service.ts`:
  - [ ] User profile CRUD operations
  - [ ] Journey stats calculation
  - [ ] Preferences management
  - [ ] Profile image upload

#### 4.3.2. Tracker Services
- [ ] Create `src/app/services/tracker.service.ts`:
  - [ ] Tracker CRUD operations (create, read, update, delete)
  - [ ] Tracker entry logging
  - [ ] Progress calculation and stats
  - [ ] Streak calculation logic
  - [ ] Default tracker templates

- [ ] Create `src/app/services/tracker-stats.service.ts`:
  - [ ] Weekly/monthly progress calculation
  - [ ] Completion rate analytics
  - [ ] Streak tracking and milestone detection
  - [ ] Progress chart data preparation

#### 4.3.3. Journal Services
- [ ] Create `src/app/services/journal.service.ts`:
  - [ ] Journal entry CRUD operations
  - [ ] Entry search and filtering
  - [ ] Mood tracking and analysis
  - [ ] Export functionality (PDF/text)

- [ ] Create `src/app/services/journal-prompts.service.ts`:
  - [ ] Default prompt management
  - [ ] Custom prompt creation
  - [ ] Prompt categorization
  - [ ] Daily prompt suggestions

---

## Phase 5: Dashboard Functionality 🚧 NEXT

### 5.1. Dashboard Components & Features

#### 5.1.1. Component Architecture
- [ ] Create reusable components in `src/app/components/dashboard/`:
  - [ ] `progress-card.component.ts` - Wellness progress display
  - [ ] `quick-stats.component.ts` - Stats grid (mindfulness, journal)
  - [ ] `recent-activity.component.ts` - Activity feed
  - [ ] `todays-intentions.component.ts` - Daily goals checklist
  - [ ] `quick-actions.component.ts` - Action buttons

#### 5.1.2. Dashboard Data Integration
- [ ] Update `tab1.page.ts` to fetch real data:
  - [ ] Inject required services (UserService, TrackerService, JournalService)
  - [ ] Load user profile and journey stats
  - [ ] Calculate wellness progress percentage
  - [ ] Fetch recent tracker entries and journal entries
  - [ ] Load today's intentions and completion status

#### 5.1.3. Dashboard Functionality
- [ ] **Progress Card Features**:
  - [ ] Real-time progress calculation based on completed trackers
  - [ ] Weekly/monthly view toggle
  - [ ] Clickable to show detailed progress
  
- [ ] **Quick Stats Features**:
  - [ ] Real mindfulness session count from tracker data
  - [ ] Real journal entry count from journal data
  - [ ] Clickable cards to navigate to respective sections
  
- [ ] **Recent Activity Features**:
  - [ ] Fetch latest tracker entries and journal entries
  - [ ] Dynamic timestamps (2 hours ago, yesterday, etc.)
  - [ ] Click to view full entry details
  - [ ] "View all" navigation to full activity feed
  
- [ ] **Today's Intentions Features**:
  - [ ] CRUD operations for daily intentions
  - [ ] Checkbox state persistence
  - [ ] Progress tracking and completion celebration
  - [ ] Custom intention creation
  
- [ ] **Quick Actions Features**:
  - [ ] "Log Mood" button → opens mood tracker entry
  - [ ] "Breathe" button → opens breathing exercise/meditation
  - [ ] Navigation to respective features

---

## Phase 6: Tracker Page Functionality 🚧 NEXT

### 6.1. Tracker Components & Features

#### 6.1.1. Component Architecture
- [ ] Create components in `src/app/components/tracker/`:
  - [ ] `tracker-card.component.ts` - Individual tracker display
  - [ ] `tracker-stats.component.ts` - Weekly summary
  - [ ] `suggested-trackers.component.ts` - Tracker recommendations
  - [ ] `completed-challenges.component.ts` - Achievement display
  - [ ] `add-tracker-modal.component.ts` - New tracker creation

#### 6.1.2. Tracker Data Integration
- [ ] Update `tab3.page.ts` to fetch real data:
  - [ ] Load user's active trackers with progress
  - [ ] Calculate completion percentages and streaks
  - [ ] Fetch weekly summary statistics
  - [ ] Load suggested trackers based on user behavior
  - [ ] Display completed challenges and achievements

#### 6.1.3. Tracker Functionality
- [ ] **Active Trackers Features**:
  - [ ] Real-time progress bars with actual completion data
  - [ ] Streak calculation and display
  - [ ] Click tracker to log new entry
  - [ ] Swipe actions (edit, delete, pause)
  - [ ] Category-based color coding:
    - Mind (blue) - meditation, focus, learning
    - Body (green) - exercise, sleep, nutrition  
    - Soul (purple) - gratitude, prayer, connection
    - Beauty (pink) - skincare, self-care, grooming
    - Mood (orange) - universal mood tracking
  
- [ ] **Tracker Entry Features**:
  - [ ] **Mind Trackers**: 
    - Duration selectors (meditation minutes, focus sessions)
    - Session counters (mindfulness practices, learning time)
    - Notes for insights and reflections
  - [ ] **Body Trackers**:
    - Numeric inputs (sleep hours, water glasses, steps)
    - Quality ratings (sleep quality, energy levels)
    - Duration tracking (exercise minutes)
  - [ ] **Soul Trackers**:
    - Text inputs (gratitude entries, prayer intentions)
    - Counter inputs (social connections, acts of kindness)
    - Duration tracking (prayer/meditation time)
  - [ ] **Beauty Trackers**:
    - Routine completion checkboxes (skincare steps)
    - Duration tracking (self-care time, grooming)
    - Photo attachment for progress tracking
  - [ ] **Universal Mood Tracker**:
    - Emoji/scale selection for daily mood (1-5)
    - Energy level rating (1-5)
    - Overall wellness scale (1-10)
    - Optional notes for context
    - Correlation with other tracker activities
  
- [ ] **Custom Tracker Creation**:
  - [ ] Choose from Mind/Body/Soul/Beauty categories
  - [ ] Select tracking type (duration, count, rating, yes/no)
  - [ ] Set custom targets and units
  - [ ] Choose icon and color within category theme
  - [ ] Define reminder settings
  
- [ ] **Tracker Analytics & Insights**:
  - [ ] Category-based progress overview
  - [ ] Mood correlation analysis (how mood affects each category)
  - [ ] Weekly/monthly trends per category
  - [ ] Goal achievement tracking
  - [ ] Streak milestones and celebrations

#### 6.1.4. Goals Functionality (Separate from Trackers)
- [ ] **Goal Management Features**:
  - [ ] Create new goals with category, target date, priority
  - [ ] Break down goals into milestones with deadlines
  - [ ] Track progress percentage and add progress notes
  - [ ] Set goal reminders and check-in schedules
  - [ ] Archive completed goals with celebration

- [ ] **Goal Categories & Templates**:
  - [ ] **Career Goals**: Job search, skill development, promotion targets
  - [ ] **Relationship Goals**: Family time, friendship building, social activities
  - [ ] **Personal Goals**: Hobbies, interests, personal projects
  - [ ] **Financial Goals**: Major purchases, debt payoff, investment targets
  - [ ] **Health Goals**: Weight targets, fitness milestones, lifestyle changes
  - [ ] **Education Goals**: Courses, certifications, learning objectives
  - [ ] **Lifestyle Goals**: Travel plans, experiences, major life changes

- [ ] **Goal Progress Tracking**:
  - [ ] Visual progress bars for each goal
  - [ ] Milestone completion checkboxes
  - [ ] Photo attachments for progress documentation
  - [ ] Integration with relevant trackers (e.g., fitness goal + exercise tracker)
  - [ ] Deadline notifications and reminders

- [ ] **Goal Analytics & Insights**:
  - [ ] Goal completion rates by category
  - [ ] Time-to-completion analysis
  - [ ] Success pattern identification
  - [ ] Goal vs tracker correlation insights

---

## Phase 7: Journal Page Functionality 🚧 NEXT

### 7.1. Journal Components & Features

#### 7.1.1. Component Architecture
- [ ] Create components in `