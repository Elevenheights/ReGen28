import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map, tap, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    // Check if we're in the middle of an OAuth redirect
    const isPendingRedirect = sessionStorage.getItem('pendingOAuthRedirect') === 'true';
    
    console.log('GuestGuard: Checking access', { isPendingRedirect });
    
    // If we're waiting for a redirect result, allow access to the login page
    if (isPendingRedirect) {
      console.log('GuestGuard: Allowing access during OAuth redirect');
      return of(true);
    }
    
    return this.authService.isAuthenticated$.pipe(
      tap(isAuthenticated => {
        console.log('GuestGuard: Auth status', { isAuthenticated });
        if (isAuthenticated) {
          // Redirect authenticated users to the main app
          console.log('GuestGuard: User authenticated, redirecting to dashboard');
          this.router.navigate(['/tabs/dashboard']);
        }
      }),
      map(isAuthenticated => !isAuthenticated)
    );
  }
} 