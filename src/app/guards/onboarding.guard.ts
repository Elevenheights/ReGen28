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
    return this.authService.isAuthenticated$.pipe(
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          // If not authenticated, redirect to login
          this.router.navigate(['/login']);
          return of(false);
        }

        // Check if user has completed onboarding
        return this.userService.getCurrentUserProfile().pipe(
          map(userProfile => {
            if (!userProfile) {
              // No user profile exists, redirect to onboarding
              this.router.navigate(['/onboarding']);
              return false;
            }

            // Check if onboarding is complete
            if (!userProfile.isOnboardingComplete) {
              this.router.navigate(['/onboarding']);
              return false;
            }

            return true;
          })
        );
      })
    );
  }
} 