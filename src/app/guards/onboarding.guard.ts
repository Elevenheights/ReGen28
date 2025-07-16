import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, switchMap, map, tap, of } from 'rxjs';
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
  ) {}

  canActivate(): Observable<boolean> {
    console.log('🛡️ OnboardingGuard: Checking onboarding status...');
    
    return this.authService.isAuthenticated$.pipe(
      switchMap(isAuthenticated => {
        console.log('🛡️ OnboardingGuard: Auth status:', isAuthenticated);
        
        if (!isAuthenticated) {
          console.log('🛡️ OnboardingGuard: Not authenticated, redirecting to login');
          this.router.navigate(['/login']);
          return of(false);
        }

        // Check if user has completed onboarding
        return this.userService.getCurrentUserProfile().pipe(
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
          })
        );
      })
    );
  }
} 