# Comprehensive Tracker Features Analysis

This document details the full scope of the ReGen28 Tracker System, based on an analysis of the data models (`tracker.interface.ts`), onboarding flows, and the `Add Tracker` configuration.

## 1. Core Identity & Customization
Every tracker is built on a flexible core that defines WHAT is being tracked and HOW.

| Feature | Description | Options |
| :--- | :--- | :--- |
| **Category** | Defined by `TrackerCategory`. Groups trackers for reporting. | Mind, Body, Soul, Beauty, Mood, Custom |
| **Tracking Type** | The fundamental input method (`TrackerType`). | • **Count** (e.g., glasses of water)<br>• **Duration** (e.g., minutes of reading)<br>• **Rating** (1-5 Stars)<br>• **Scale** (1-10 Intensity)<br>• **Boolean** (Yes/No Completion) |
| **Frequency** | Determines the reporting cycle (`TrackerFrequency`). | Daily, Weekly, Monthly |
| **Target & Unit** | User-defined goals. | e.g., "8 Glasses", "30 Minutes", "1 Chapter" |

## 2. Modes & Lifecycle
Trackers function in two distinct modes, handling both short-term challenges and long-term habits.

*   **🏆 Challenge Mode:** Time-limited (e.g., "28-Day Sugar Detox"). Has a strict `startDate`, `durationDays`, and `endDate`. Tracks completion of the challenge itself.
*   **♾️ Ongoing Mode:** Continuous habit building with no end date. Focus is on maintaining streaks and consistency ('Lifestyle').

## 3. The "Logging Fields" System (Configurable Context)
This is a critical, highly-granular feature set. When creating a tracker, the user can toggle 11 distinct "Logging Fields" (`LoggingFieldConfig`). **Each tracker entry can capture any combination of these context data points.**

### A. Emotional & Mental State
*   **Mood:** 1-10 Scale. (Default: 1-10 emoji slider).
*   **Energy Level:** 1-5 Scale. (High/Low battery indicator).

### B. Quality Metrics
*   **Duration:** Timer or manual entry (Minutes). *Distinct from the main value if the tracker type isn't Duration.*
*   **Intensity:** 1-10 Scale (e.g., Workout intensity).
*   **Quality/Satisfaction:** 1-10 Scale.

### C. Context & Media
*   **Notes:** Rich text or simple text notes.
*   **Tags:** Dynamic tagging system (`#legday`, `#tired`).
*   **Social Context:** "Alone", "With Others", "Group".
*   **Photos:** Image attachments (Proof of work / progress pics).
*   **Location:** GPS Coordinates & Address (Where did this happen?).
*   **Weather:** Auto-fetched or manual weather data (Temp, Condition).

## 4. Notifications & Reminders
*   **Multiple Reminders:** Users can set multiple specific times per day (e.g., 9:00 AM, 12:00 PM, 6:00 PM) for each tracker.
*   **Days of Week:** Reminders can arguably be scoped to specific days (implied by `reminderDays` in config).

## 5. Statistical & Analytical Features
The system computes derived metrics relative to these features:
*   **Streaks:** Current and Longest streaks.
*   **Compliance:** Completion Rate % (based on Frequency).
*   **Mood Correlation:** How this habit affects the user's average mood.
*   **Trends:** Weekly/Monthly volume analysis.

## 6. UI Implications for Log Modal
To fully support the app's capabilities, the "Log Activity" modal must responsibly handle **all** enabled fields for a given tracker. It cannot simply show a default set; it must dynamically render:
1.  **The "Hero" Value** (The main Count/Duration/Boolean).
2.  **Conditional Sections:**
    *   If `config.trackWeather` is true -> Show Weather Widget.
    *   If `config.trackLocation` is true -> Show Location Pin/Map.
    *   If `config.trackPhotos` is true -> Show Camera/Upload UI.
    *   If `config.trackSocial` is true -> Show Social Context Selector.
    *   Plus all the Quality/Mood sliders.

**Current Gap Analysis:**
The previous UI redesign missed visual components for **Weather**, **Location**, and fully functional **Photos**. It also requires robust handling of **Challenge vs Ongoing** progress display within the modal context.
