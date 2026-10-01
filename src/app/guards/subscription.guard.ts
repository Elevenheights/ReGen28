import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, take, switchMap, of, catchError, timeout } from 'rxjs';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionGuard implements CanActivate {

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) {
          return of(this.router.createUrlTree(['/login']));
        }
        
        return this.userService.getCurrentUserProfile().pipe(
          take(1),
          map(profile => {
            if (!profile) return this.router.createUrlTree(['/login']);

            const expiration = profile.subscriptionExpiration ?? profile.trialEndsAt;
            const date = expiration as unknown as { toDate?: () => Date };
            const expiresAt = date?.toDate ? date.toDate() : expiration ? new Date(expiration) : null;
            if (profile.status === 'active' && (!expiresAt || expiresAt.getTime() > Date.now())) {
              return true;
            }
            return this.router.createUrlTree(['/subscription']);
          })

        );
      }),
      timeout(10000),
      catchError(() => of(this.router.createUrlTree(['/subscription'])))
    );
  }
}
