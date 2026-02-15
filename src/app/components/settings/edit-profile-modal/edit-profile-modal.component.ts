import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonButtons,
	IonItem,
	IonLabel,
	IonInput,
	IonIcon,
	IonAvatar,
	IonSpinner,
	IonFooter,
	IonSelect,
	IonSelectOption,
	ModalController
} from '@ionic/angular/standalone';
import { User } from '../../../models/user.interface';
import { UserService } from '../../../services/user.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';

@Component({
	selector: 'app-edit-profile-modal',
	templateUrl: './edit-profile-modal.component.html',
	styleUrls: ['./edit-profile-modal.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonContent,
		IonButton,
		IonButtons,
		IonItem,
		IonLabel,
		IonInput,
		IonIcon,
		IonAvatar,
		IonSpinner,
		IonIcon,
		IonAvatar,
		IonSpinner,
		IonFooter,
		IonSelect,
		IonSelectOption
	]
})
export class EditProfileModalComponent implements OnInit {
	@Input() user: User | null = null;

	countries = [
		"United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "Japan", "India", "Brazil", "Mexico",
		"Argentina", "Austria", "Belgium", "Chile", "China", "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland",
		"Greece", "Hong Kong", "Hungary", "Indonesia", "Ireland", "Israel", "Italy", "Malaysia", "Netherlands", "New Zealand",
		"Norway", "Philippines", "Poland", "Portugal", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
		"Spain", "Sweden", "Switzerland", "Taiwan", "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "Vietnam"
	].sort();

	profileForm!: FormGroup;
	isSaving = false;
	isUploading = false;
	profileImageUrl = '';

	constructor(
		private fb: FormBuilder,
		private modalCtrl: ModalController,
		private userService: UserService,
		private logging: LoggingService,
		private toastService: ToastService
	) { }

	ngOnInit() {
		this.profileImageUrl = this.user?.photoURL || `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.user?.displayName || 'User'}`;

		let country = '';
		let city = '';
		const userLocation = this.user?.location;
		if (userLocation) {
			const parts = userLocation.split(',').map(s => s.trim());
			if (parts.length >= 2) {
				// Assume "City, Country" - check if last part matches a known country, or just take last part
				country = parts[parts.length - 1];
				city = parts.slice(0, parts.length - 1).join(', ');
			} else {
				city = userLocation;
			}
		}

		this.profileForm = this.fb.group({
			displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(2)]],
			country: [country],
			city: [city],
			email: [{ value: this.user?.email || '', disabled: true }] // Email usually fixed or needs separate flow
		});
	}

	dismiss() {
		this.modalCtrl.dismiss();
	}

	async onFileSelected(event: any) {
		const file = event.target.files[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			this.toastService.showError('Please select an image file');
			return;
		}

		if (file.size > 5 * 1024 * 1024) { // 5MB limit
			this.toastService.showError('Image must be less than 5MB');
			return;
		}

		this.isUploading = true;
		try {
			this.logging.info('Uploading new profile image');
			const downloadURL = await this.userService.uploadProfileImage(file);
			this.profileImageUrl = downloadURL;
			this.toastService.showSuccess('Image uploaded successfully');
		} catch (error) {
			this.logging.error('Failed to upload image', error);
			this.toastService.showError('Failed to upload image. Please try again.');
		} finally {
			this.isUploading = false;
		}
	}

	async save() {
		if (this.profileForm.invalid) return;

		this.isSaving = true;
		try {
			const country = this.profileForm.value.country;
			const city = this.profileForm.value.city;
			const location = (city && country) ? `${city}, ${country}` : (city || country || '');

			const updates: Partial<User> = {
				displayName: this.profileForm.value.displayName,
				location: location
			};

			this.logging.info('Saving profile updates', updates);
			await this.userService.updateUserProfile(updates);
			this.toastService.showSuccess('Profile updated successfully');
			this.modalCtrl.dismiss({ saved: true });
		} catch (error) {
			this.logging.error('Failed to save profile updates', error);
			this.toastService.showError('Failed to update profile. Please try again.');
		} finally {
			this.isSaving = false;
		}
	}

	getJoinDate(): Date | null {
		if (!this.user?.joinDate) return null;

		// Handle Firestore Timestamp
		if (typeof (this.user.joinDate as any).toDate === 'function') {
			return (this.user.joinDate as any).toDate();
		}

		// Handle Date string or number
		return new Date(this.user.joinDate);
	}
}
