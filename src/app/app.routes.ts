import { Routes } from '@angular/router';
import { GuestGuard } from './guards/guest.guard';
import { AuthGuard } from './guards/auth.guard';
import { OnboardingGuard } from './guards/onboarding.guard';
import { SubscriptionGuard } from './guards/subscription.guard';

export const routes: Routes = [
	{
		path: 'ai-consent',
		loadComponent: () => import('./pages/ai-consent/ai-consent.page').then(m => m.AiConsentPage),
		canActivate: [AuthGuard]
	},
	{
		path: 'account',
		loadComponent: () => import('./pages/tabs/settings/tab4.page').then(m => m.Tab4Page),
		canActivate: [AuthGuard]
	},
	// Intro page (first time visitors)
	{
		path: '',
		redirectTo: '/intro',
		pathMatch: 'full'
	},
	{
		path: 'intro',
		loadComponent: () => import('./pages/intro/intro.page').then(m => m.IntroPage),
		canActivate: [GuestGuard]
	},

	// Main app routes - delegates to tabs.routes.ts which handles guards
	{
		path: 'tabs',
		loadChildren: () => import('./pages/tabs/tabs.routes').then((m) => m.routes),
		canActivate: [AuthGuard, OnboardingGuard, SubscriptionGuard]
	},

	// Tracker detail page (requires auth and completed onboarding)
	{
		path: 'tracker-detail/:id',
		loadComponent: () => import('./pages/tracker-detail/tracker-detail.page').then(m => m.TrackerDetailPage),
		canActivate: [AuthGuard, OnboardingGuard, SubscriptionGuard]
	},

	// Journal entry page (requires auth and completed onboarding)
	{
		path: 'journal-entry/:id',
		loadComponent: () => import('./pages/journal-entry/journal-entry.page').then(m => m.JournalEntryPage),
		canActivate: [AuthGuard, OnboardingGuard, SubscriptionGuard]
	},

	// Activities history page
	{
		path: 'activities',
		loadComponent: () => import('./pages/activities/activities.page').then(m => m.ActivitiesPage),
		canActivate: [AuthGuard, OnboardingGuard, SubscriptionGuard]
	},

	// Authentication routes (only for non-authenticated users)
	{
		path: 'login',
		loadComponent: () => import('./pages/auth/login/login.page').then(m => m.LoginPage),
		canActivate: [GuestGuard]
	},
	{
		path: 'register',
		loadComponent: () => import('./pages/auth/register/register.page').then(m => m.RegisterPage),
		canActivate: [GuestGuard]
	},

	// Onboarding routes (requires auth but allows incomplete onboarding)
	{
		path: 'onboarding',
		children: [
			{
				path: '',
				redirectTo: 'welcome',
				pathMatch: 'full'
			},
			{
				path: 'welcome',
				loadComponent: () => import('./pages/onboarding/welcome/welcome.page').then(m => m.WelcomePage),
				canActivate: [AuthGuard]
			},
			{
				path: 'profile',
				loadComponent: () => import('./pages/onboarding/profile/profile.page').then(m => m.ProfilePage),
				canActivate: [AuthGuard]
			},
			{
				path: 'goals',
				loadComponent: () => import('./pages/onboarding/goals/goals.page').then(m => m.GoalsPage),
				canActivate: [AuthGuard]
			},
			{
				path: 'trackers',
				loadComponent: () => import('./pages/onboarding/trackers/trackers.page').then(m => m.TrackersPage),
				canActivate: [AuthGuard]
			},
			{
				path: 'photo-upload',
				loadComponent: () => import('./pages/onboarding/photo-upload/photo-upload.page').then(m => m.PhotoUploadPage),
				canActivate: [AuthGuard]
			},
			{
				path: 'complete',
				loadComponent: () => import('./pages/onboarding/complete/complete.page').then(m => m.CompletePage),
				canActivate: [AuthGuard]
			}
		]
	},

	{
		path: 'goals',
		loadComponent: () => import('./pages/goals/goals.page').then(m => m.GoalsPage),
		canActivate: [AuthGuard, SubscriptionGuard]
	},
	{
		path: 'archived-trackers',
		loadComponent: () => import('./pages/archived-trackers/archived-trackers.page').then(m => m.ArchivedTrackersPage),
		canActivate: [AuthGuard, SubscriptionGuard]
	},

  {
    path: 'subscription',
    loadComponent: () => import('./pages/subscription/subscription.page').then(m => m.SubscriptionPage)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.page').then(m => m.PrivacyPage)
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.page').then(m => m.TermsPage)
  },

	// Fallback route (must be last)
	{
		path: '**',
		redirectTo: '/intro'
	}
];
