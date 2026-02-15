import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonContent,
	IonHeader,
	IonToolbar,
	IonButtons,
	IonBackButton,
	IonButton,
	IonIcon,
	IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
	personCircleOutline,
	accessibilityOutline,
	cameraOutline,
	createOutline,
	bodyOutline
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { finalize } from 'rxjs/operators';
import { LoggingService } from '../../../services/logging.service';

@Component({
	selector: 'app-photo-upload',
	templateUrl: './photo-upload.page.html',
	styleUrls: ['./photo-upload.page.scss'],
	standalone: true,
	imports: [
		IonContent,
		IonHeader,
		IonToolbar,
		IonButtons,
		IonBackButton,
		IonButton,
		IonIcon,
		IonSpinner,
		CommonModule,
		FormsModule
	]
})
export class PhotoUploadPage implements OnInit {
	faceImagePreview: string | null = null;
	bodyImagePreview: string | null = null;

	faceImageBase64: string | null = null;
	bodyImageBase64: string | null = null;

	isUploading = false;

	constructor(
		private router: Router,
		private userService: UserService,
		private authService: AuthService,
		private toastService: ToastService,
		private logging: LoggingService
	) {
		addIcons({
			personCircleOutline,
			accessibilityOutline,
			cameraOutline,
			createOutline,
			bodyOutline
		});
	}

	ngOnInit() {
	}

	async selectImage(type: 'face' | 'body') {
		try {
			const image = await Camera.getPhoto({
				quality: 90,
				allowEditing: false,
				resultType: CameraResultType.Base64,
				source: CameraSource.Prompt,
				width: 1024 // Reasonable max width for upload
			});

			if (image.base64String) {
				const base64 = `data:image/${image.format};base64,${image.base64String}`;

				if (type === 'face') {
					this.faceImagePreview = base64;
					this.faceImageBase64 = image.base64String;
				} else {
					this.bodyImagePreview = base64;
					this.bodyImageBase64 = image.base64String;
				}
			}
		} catch (error: any) {
			this.logging.error('Error selecting image', error);
			if (error?.message !== 'User cancelled photos app') {
				this.toastService.showError('Failed to access camera/photos. Please check permissions.');
			}
		}
	}

	async onContinue() {
		if (!this.faceImageBase64 && !this.bodyImageBase64) {
			this.onSkip();
			return;
		}

		this.isUploading = true;

		try {
			const updates: any = {};
			const authUser = this.authService.getCurrentUser();
			const userId = authUser?.uid;

			if (!userId) {
				throw new Error('No user ID found');
			}

			// We'll assume UserService has a method or we'll add one to upload base64
			// For now, if UserService doesn't have a direct uploadBase64, we might need to implement it
			// or use the storage service directly if accessible. 
			// Let's assume we can call a method on UserService to handle this.

			if (this.faceImageBase64) {
				const url = await this.userService.uploadUserImage(userId, this.faceImageBase64, 'reference_face.jpg');
				updates.referenceImageFace = url;
			}

			if (this.bodyImageBase64) {
				const url = await this.userService.uploadUserImage(userId, this.bodyImageBase64, 'reference_body.jpg');
				updates.referenceImageBody = url;
			}

			await this.userService.updateUserProfile(updates);
			this.toastService.showSuccess('Photos uploaded successfully!');
			this.router.navigate(['/onboarding/complete']);

		} catch (error) {
			this.logging.error('Upload failed', error);
			this.toastService.showError('Failed to upload photos. Please try again.');
		} finally {
			this.isUploading = false;
		}
	}

	onSkip() {
		this.router.navigate(['/onboarding/complete']);
	}
}
