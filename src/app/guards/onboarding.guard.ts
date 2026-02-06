import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, switchMap, map, of, timeout, catchError, take, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Injectable({
	providedIn: 'root'
})
export class OnboardingGuard implements CanActivate {

	constructor(
		private authService: AuthService,
		private userService: UserService,
		private router: Router
	) { }

	canActivate(): Observable<boolean> {
		console.log('🛡️ OnboardingGuard: Checking onboarding status...');

		return this.authService.isAuthenticated$.pipe(
			take(1), // Only take first emission to prevent re-triggering
			switchMap(isAuthenticated => {
				console.log('🛡️ OnboardingGuard: Auth status:', isAuthenticated);

				if (!isAuthenticated) {
					console.log('🛡️ OnboardingGuard: Not authenticated, redirecting to login');
					this.router.navigate(['/login']);
					return of(false);
				}

				// Check if user has completed onboarding
				// Use filter to skip any initial null/loading states and take(1) to get first valid profile
				return this.userService.getCurrentUserProfile().pipe(
					// Filter out profiles that might be from cache/initial load with undefined isOnboardingComplete
					filter(profile => profile !== null && profile.id !== undefined),
					take(1), // Only take the first valid profile emission
					timeout(10000), // 10 second timeout to prevent infinite waiting
					map(userProfile => {
						console.log('🛡️ OnboardingGuard: User profile:', {
							exists: !!userProfile,
							isOnboardingComplete: userProfile?.isOnboardingComplete,
							email: userProfile?.email
						});

						if (!userProfile) {
							console.log('🛡️ OnboardingGuard: No user profile, redirecting to onboarding');
							this.router.navigate(['/onboarding']);
							return false;
						}

						// Check if onboarding is complete
						if (!userProfile.isOnboardingComplete) {
							console.log('🛡️ OnboardingGuard: Onboarding incomplete, redirecting to onboarding');
							this.router.navigate(['/onboarding']);
							return false;
						}

						console.log('🛡️ OnboardingGuard: Onboarding complete, allowing access to main app');
						return true;
					}),
					catchError(error => {
						// On timeout or any error, allow access (don't block user) but log it
						console.error('🛡️ OnboardingGuard: Error checking onboarding status, allowing access:', error);
						return of(true); // Fail open - don't lock user out
					})
				);
			})
		);
	}
}
