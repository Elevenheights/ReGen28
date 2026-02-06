import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonContent,
	IonHeader,
	IonTitle,
	IonToolbar
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Components
import { EditProfileModalComponent } from '../../../components/settings/edit-profile-modal/edit-profile-modal.component';

// Services
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';
import { Router } from '@angular/router';

// Models
import { User } from '../../../models/user.interface';

@Component({
	selector: 'app-tab4',
	templateUrl: './tab4.page.html',
	styleUrls: ['./tab4.page.scss'],
	standalone: true,
	imports: [
		IonContent,
		IonHeader,
		IonTitle,
		IonToolbar,
		CommonModule,
		FormsModule
	]
})
export class Tab4Page implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// User data
	user: User | null = null;

	// Profile image
	profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
	userDisplayName = 'User';

	constructor(
		private userService: UserService,
		private authService: AuthService,
		private logging: LoggingService,
		private toastService: ToastService,
		private router: Router,
		private modalCtrl: ModalController
	) { }

	ngOnInit() {
		this.loadUserProfile();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private loadUserProfile() {
		this.userService.getCurrentUserProfile().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (user) => {
				this.user = user;
				this.updateProfileImageUrl();
			},
			error: (error) => {
				this.logging.error('Failed to load user profile', { error });
			}
		});
	}

	private updateProfileImageUrl() {
		if (this.user) {
			this.userDisplayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';

			// Use Dicebear avatar with user's name as seed for consistency
			this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;

			// Use actual photo if available
			if (this.user.photoURL) {
				const photoURL = this.user.photoURL;
				this.profileImageUrl = photoURL;
			}
		}
	}

	onImageError(event: any) {
		// Fallback to Dicebear avatar if image fails to load
		this.logging.debug('Profile image failed to load, using fallback');
		this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
	}

	onImageLoad(event: any) {
		this.logging.debug('Profile image loaded successfully');
	}

	getProfileImageUrl(): string {
		return this.profileImageUrl;
	}

	async onSignOut() {
		try {
			this.logging.info('User signing out from settings');
			await this.authService.logout();
			this.router.navigate(['/login'], { replaceUrl: true });
			this.toastService.showSuccess('Signed out successfully');
		} catch (error) {
			this.logging.error('Error signing out', error);
			this.toastService.showError('Failed to sign out. Please try again.');
		}
	}

	async onEditProfile() {
		this.logging.info('Opening profile edit modal');
		const modal = await this.modalCtrl.create({
			component: EditProfileModalComponent,
			componentProps: { user: this.user },
			cssClass: 'edit-profile-modal',
			breakpoints: [0, 0.5, 0.9],
			initialBreakpoint: 0.9
		});

		await modal.present();

		const { data } = await modal.onDidDismiss();
		if (data?.saved) {
			this.loadUserProfile();
		}
	}

	onToggleSetting(setting: string, event: any) {
		const value = event.target.checked;
		this.logging.debug(`Setting toggled: ${setting} = ${value}`);

		let preferenceUpdate: any = {};
		switch (setting) {
			case 'Reminders':
				preferenceUpdate.dailyReminders = value;
				break;
			case 'Dark Mode':
				preferenceUpdate.darkMode = value;
				break;
			case 'Developer Mode':
				preferenceUpdate.developerMode = value;
				break;
		}

		this.userService.updatePreferences(preferenceUpdate).then(() => {
			this.toastService.showSuccess(`${setting} updated`);
		}).catch(error => {
			this.logging.error(`Failed to update ${setting}`, error);
			this.toastService.showError(`Could not update ${setting}`);
		});
	}
}
