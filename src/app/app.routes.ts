import { Routes } from '@angular/router';
import { GuestGuard } from './guards/guest.guard';
import { AuthGuard } from './guards/auth.guard';
import { OnboardingGuard } from './guards/onboarding.guard';

export const routes: Routes = [
	// Intro page (first time visitors)
	{
		path: '',
		redirectTo: '/intro',
		pathMatch: 'full'
	},
	{
		path: 'intro',
		loadComponent: () => import('./pages/intro/intro.page').then(m => m.IntroPage)
	},

	// Main app routes - delegates to tabs.routes.ts which handles guards
	{
		path: 'tabs',
		loadChildren: () => import('./pages/tabs/tabs.routes').then((m) => m.routes)
	},

	// Tracker detail page (requires auth and completed onboarding)
	{
		path: 'tracker-detail/:id',
		loadComponent: () => import('./pages/tracker-detail/tracker-detail.page').then(m => m.TrackerDetailPage),
		canActivate: [AuthGuard, OnboardingGuard]
	},

	// Journal entry page (requires auth and completed onboarding)
	{
		path: 'journal-entry/:id',
		loadComponent: () => import('./pages/journal-entry/journal-entry.page').then(m => m.JournalEntryPage),
		canActivate: [AuthGuard, OnboardingGuard]
	},

	// Activities history page
	{
		path: 'activities',
		loadComponent: () => import('./pages/activities/activities.page').then(m => m.ActivitiesPage),
		canActivate: [AuthGuard, OnboardingGuard]
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
				path: 'complete',
				loadComponent: () => import('./pages/onboarding/complete/complete.page').then(m => m.CompletePage),
				canActivate: [AuthGuard]
			}
		]
	},

	// Fallback route
	{
		path: '**',
		redirectTo: '/intro'
	},
	{
		path: 'goals',
		loadComponent: () => import('./pages/goals/goals.page').then(m => m.GoalsPage)
	}
];
