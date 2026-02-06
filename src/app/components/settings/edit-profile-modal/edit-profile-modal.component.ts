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
		IonSpinner
	]
})
export class EditProfileModalComponent implements OnInit {
	@Input() user: User | null = null;

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

		this.profileForm = this.fb.group({
			displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(2)]],
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
			const updates: Partial<User> = {
				displayName: this.profileForm.value.displayName
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
}
