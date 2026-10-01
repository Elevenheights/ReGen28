import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { Subscription, switchMap, distinctUntilChanged, of, skip } from 'rxjs';
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
		private userService: UserService,
	) { }

	ngOnInit() {
		this.setupAuthRedirect();
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	private setupAuthRedirect() {
		// React only to AUTH STATE CHANGES after initial load.
		// Guards handle routing on navigation — this only handles transitions
		// like sign-out (send to /intro) or sign-in from intro (send to dashboard).
		const sub = this.authService.isAuthenticated$.pipe(
			skip(1), // skip initial emission — guards handle the first load
			distinctUntilChanged(),
			switchMap(isAuth => isAuth ? this.userService.getCurrentUserProfile() : of(null))
		).subscribe(userProfile => {
			if (!userProfile) {
				// Signed out
				this.router.navigate(['/intro']);
				return;
			}
			if (userProfile.isOnboardingComplete) {
				this.router.navigate(['/tabs/dashboard']);
			} else {
				this.router.navigate(['/onboarding']);
			}
		});

		this.subscriptions.add(sub);
	}
}
