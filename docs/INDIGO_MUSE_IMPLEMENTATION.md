# Regen 28 — Indigo Muse implementation

Approved direction: Concept E. Updated November 15, 2026 to restore the original dashboard and supporting functions while matching the approved reference more closely.

## Design and navigation

Today uses editorial photography, a real journey day count, a vertical 28-day indicator, a curved lavender focus panel and live tracker logging controls. Trackers uses individual photographic tracker selectors, a large target, real seven-day logging history, notes and completion controls. Existing app terminology is retained: Trackers, not Rituals.

Timeline is a dedicated private story with a date/time rail, compact photographic progress cards, satin coach cards and a satin journey sharing panel. Recent days appear first; events within each day appear in chronological order. Post likes, comments and sharing remain accessible from the small post-options menu. Linked coach actions open logging or a reviewed target adjustment. Explanations expand without clipping.

The three primary tabs are Today, Trackers and Timeline. Each has an explicit Full Dashboard link in its header. Journal, Goals, account, archived trackers and detailed activity remain accessible through dashboard tools, page links and account navigation. Existing routes remain available.

## Functionality restored

- Full dashboard: journey, daily completion, guidance/actions/insights and refresh, engagement summary, mood/consistency/streak summaries, weekly activity, real week/month mood history, top trackers, four category summaries, goals and recent activity.
- Dashboard tools: mood logging, breathing, activity logging and journal; motivational quotes retain their navigation/autoplay behavior when multiple quotes are available.
- Trackers: weekly/current/total/best statistics, individual progress, detail streak/completion, quick logging, full logging fields, archived/completed history and creation.
- Journal: total/week entries, streak, average mood, entry editing and existing reflection prompts.
- Goals: progress, priorities, milestones and goal creation.
- Account: achievement level/points, feed-notification and dark-mode preferences, admin-only developer controls, existing generation actions and model settings. Dark-mode preference preserves the original stored setting; the approved E appearance is the current visual theme.
- Feed: original specialized tracker/stat/milestone/journal content, images, metrics, tags, comments, likes and sharing. Existing feed exclusions and persisted sanctuary-notice dismissal remain supported.
- Existing account, subscription, consent and onboarding routes and service flows remain in place.

Mood charts use actual journal records on a 1–10 scale, daily averages, local dates and gaps for missing check-ins. The month control requests a real 30-day range. The previous wellness score is displayed as engagement with a clear nonmedical explanation; underlying statistical generators remain a separate audit concern.

## Assets and framework

The app continues with Angular, Ionic and Capacitor. Photography and the new satin texture are in `src/assets/images/indigo-muse`; generation prompts are recorded in that folder’s README. These are decorative lifestyle illustrations, not user photographs or predicted results. Progress-card photos come from the actual post when present.

## Verification

- Production Angular build passes with bundle/style-budget and existing dependency warnings.
- 61 targeted tests cover subscription access, billing UI, tracker loading/history, timeline ordering, feed exclusion/actions, supplementary metric retention, dismissal, dashboard charts/tools, journal/account navigation and goal creation.
- Browser verification uses the actual Angular templates with isolated fictional preview services. Checked Today, tracker selection/history, full logging overlays, the full dashboard and 30-day chart control, breathing, timeline explanations, comments and linked coach logging. No preview records were saved and no purchase or sharing was submitted.
- Rendered previews are in `store-assets/redesign-preview-20261115`. These are web previews with fictional data, not native iPhone captures or final App Store screenshots.

## Component completion pass — November 15

Reviewed every routed page and reusable component. Rebuilt tracker suggestions as a satin action panel, numbered insights and an editorial quote. Updated the older guidance/inspiration carousels and tracker/stat/milestone/journal feed variants; retained supplementary metrics while eliminating repeated titles, bodies and main metrics. Journal feed dates support Firestore timestamps as well as ordinary dates.

Unified logging, journal and profile sheets, comments, Quill editing, breathing, Ionic alerts/action sheets/popovers/loading/toasts, reusable journal summaries/prompts/mood views, completed challenges, separators and profile placeholders. Older tracker list and add-tracker modal variants share the same supporting-component styles. Tracker colors remain available as small identity accents. Updated activity history, photo setup, auth wordmarks and legal-page navigation. All existing events, data bindings, form validation, logging fields, purchase handling and account actions remain in place.

Removed the old global rules that forced cream backgrounds and imposed spacing/typography on every header, section, card and utility class. Each redesigned component now controls its own layout. The shared compatibility layer is scoped to supporting forms and reusable components.

Visual QA covered 25 actual page routes and the local component gallery, plus journal/profile/logging/comments/breathing overlays. Checked tracker creation mode switching, guidance carousel navigation, journal edit access, comment access and overlay closing. Phone previews were checked at 390×844, with an additional 320×568 check. Latest captures are in `store-assets/component-finish-20261115`. The local gallery (`src/component-preview.ts`) is only imported by the screenshot preview bootstrap and is excluded from production.

## Release limits

The separate security/backend audit findings remain open, including feed authorization/ownership and generated statistics concerns. Existing activity-mapped feed IDs may not have persisted comment/like documents; this frontend restoration does not resolve that backend issue. Native iOS keyboard/safe-area behavior, device performance, purchase/restore continuity and final accessibility testing need release-build validation. No deployment, TestFlight upload or App Store resubmission was performed.
