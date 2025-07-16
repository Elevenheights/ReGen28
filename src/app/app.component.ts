import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { Subscription, combineLatest, filter, switchMap, distinctUntilChanged, of } from 'rxjs';
import { TrackerLogModalComponent } from './components/tracker-log-modal/tracker-log-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, TrackerLogModalComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.setupGlobalNavigationLogic();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private setupGlobalNavigationLogic() {
    // Listen to authentication state and onboarding completion globally
    const navigationSub = combineLatest([
      this.authService.isAuthenticated$,
      this.authService.isAuthenticated$.pipe(
        switchMap(isAuth => isAuth ? this.userService.getCurrentUserProfile() : of(null))
      ),
      this.router.events.pipe(filter(event => event instanceof NavigationEnd))
    ]).pipe(
      distinctUntilChanged(([prevAuth, prevUser, prevNav], [currAuth, currUser, currNav]) => {
        return prevAuth === currAuth && 
               prevUser?.isOnboardingComplete === currUser?.isOnboardingComplete &&
               (prevNav as NavigationEnd).url === (currNav as NavigationEnd).url;
      })
    ).subscribe(([isAuthenticated, userProfile, navEvent]) => {
      const currentUrl = (navEvent as NavigationEnd).url;

      // Skip navigation logic for certain routes
      if (this.shouldSkipNavigation(currentUrl)) {
        return;
      }

      this.handleGlobalNavigation(isAuthenticated, userProfile, currentUrl);
    });

    this.subscriptions.add(navigationSub);
  }

  private shouldSkipNavigation(url: string): boolean {
    // Skip auto-navigation for these routes
    const skipRoutes = ['/login', '/register'];
    return skipRoutes.some(route => url.startsWith(route));
  }

  private handleGlobalNavigation(isAuthenticated: boolean, userProfile: any, currentUrl: string) {
    if (!isAuthenticated) {
      // Not authenticated - allow intro/login/register pages
      if (!currentUrl.startsWith('/intro') && 
          !currentUrl.startsWith('/login') && 
          !currentUrl.startsWith('/register')) {
        this.router.navigate(['/intro']);
      }
      return;
    }

    // Authenticated user
    if (!userProfile) {
      return;
    }

    const isOnboardingComplete = userProfile.isOnboardingComplete;

    if (isOnboardingComplete) {
      // Onboarding complete - redirect away from intro/onboarding pages
      if (currentUrl.startsWith('/intro') || currentUrl.startsWith('/onboarding')) {
        this.router.navigate(['/tabs/dashboard']);
      }
    } else {
      // Onboarding incomplete - redirect to onboarding
      if (currentUrl.startsWith('/intro') || currentUrl.startsWith('/tabs')) {
        this.router.navigate(['/onboarding']);
      }
    }
  }
}
