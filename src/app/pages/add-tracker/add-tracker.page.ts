import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonButtons,
	IonIcon,
	IonItem,
	IonInput,
	IonSelect,
	IonSelectOption,
	IonSegment,
	IonSegmentButton,
	IonLabel,
	IonGrid,
	IonRow,
	IonCol,
	IonRange,
	IonCheckbox,
	IonTextarea,
	IonToggle,
	IonToast,
	IonCard,
	IonCardContent,
	IonChip,
	IonSpinner
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
	add,
	remove,
	checkmark,
	gridOutline,
	createOutline,
	arrowBack,
	notifications,
	notificationsOutline,
	close
} from 'ionicons/icons';

// Services
import { TrackerService } from '../../services/tracker.service';
import { ConfigService } from '../../services/config.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { LoggingService } from '../../services/logging.service';

// Models
import { TrackerCategory, TrackerType, TrackerFrequency } from '../../models/tracker.interface';

@Component({
	selector: 'app-add-tracker',
	templateUrl: './add-tracker.page.html',
	styleUrls: ['./add-tracker.page.scss'],
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
		IonIcon,
		IonItem,
		IonInput,
		IonSelect,
		IonSelectOption,
		IonSegment,
		IonSegmentButton,
		IonLabel,
		IonGrid,
		IonRow,
		IonCol,
		IonRange,
		IonCheckbox,
		IonTextarea,
		IonToggle,
		IonToast,
		IonCard,
		IonCardContent,
		IonChip,
		IonSpinner,
		IonCheckbox
	]
})
export class AddTrackerPage implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// UI State
	selectedMode: 'template' | 'custom' = 'template';
	selectedCategory: TrackerCategory = TrackerCategory.MIND;
	isLoading = false;
	showToast = false;
	toastMessage = '';

	// Data
	trackerCategories = [
		{ key: TrackerCategory.MIND, label: 'Mind', icon: 'brain-outline' },
		{ key: TrackerCategory.BODY, label: 'Body', icon: 'fitness-outline' },
		{ key: TrackerCategory.SOUL, label: 'Soul', icon: 'heart-outline' },
		{ key: TrackerCategory.BEAUTY, label: 'Beauty', icon: 'flower-outline' }
	];
	customTrackerForm!: FormGroup;
	existingTrackers: any[] = [];
	existingTrackerNames: string[] = [];

	// Tracker selection state (like onboarding)
	selectedTrackers: { [key: string]: any } = {};

	// Duration editing state
	editingDuration: { [key: string]: boolean } = {};

	// Target editing state
	editingTarget: { [key: string]: boolean } = {};

	// Notification times management per tracker
	trackerNotificationTimes: { [trackerId: string]: string[] } = {};
	trackerNewNotificationTime: { [trackerId: string]: string } = {};

	// For custom tracker
	customNotificationTimes: string[] = [];
	customNewNotificationTime: string = '';

	// Expose enums for template
	TrackerCategory = TrackerCategory;
	TrackerType = TrackerType;
	TrackerFrequency = TrackerFrequency;

	constructor(
		private router: Router,
		private route: ActivatedRoute,
		private formBuilder: FormBuilder,
		private trackerService: TrackerService,
		private configService: ConfigService,
		private errorHandling: ErrorHandlingService,
		private logging: LoggingService
	) {
		// Register icons
		addIcons({ add, remove, checkmark, gridOutline, createOutline, arrowBack, notifications, notificationsOutline, close });
		this.initializeCustomForm();
	}

	ngOnInit() {
		this.logging.info('Add Tracker page initialized');
		this.loadExistingTrackers();
	}

	private loadExistingTrackers() {
		// Load existing trackers to prevent duplicates
		this.trackerService.getUserTrackers().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (trackers) => {
				// Only consider active, non-completed trackers for duplicate prevention
				this.existingTrackers = trackers.filter(t => t.isActive && !t.isCompleted);
				this.existingTrackerNames = this.existingTrackers.map(t => t.name.toLowerCase().trim());
				this.logging.debug('Loaded existing active trackers for duplicate prevention', {
					count: this.existingTrackers.length,
					names: this.existingTrackerNames
				});
			},
			error: (error) => {
				this.logging.error('Failed to load existing trackers', { error });
			}
		});
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private initializeCustomForm() {
		this.customTrackerForm = this.formBuilder.group({
			name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
			category: [TrackerCategory.MIND, Validators.required],
			type: [TrackerType.COUNT, Validators.required],
			frequency: [TrackerFrequency.DAILY, Validators.required],
			unit: ['', [Validators.required, Validators.maxLength(20)]],
			target: [1, [Validators.required, Validators.min(1), Validators.max(1000)]],
			color: ['#3B82F6', Validators.required],
			icon: ['checkmark-circle', Validators.required],
			durationType: ['challenge', Validators.required],
			durationDays: [28, [Validators.min(1), Validators.max(365)]],
			isOngoing: [false],
			// Additional logging fields
			trackMood: [false],
			trackEnergy: [false],
			trackDuration: [false],
			trackIntensity: [false],
			trackQuality: [false],
			trackNotes: [false],
			trackTags: [false],
			trackSocialContext: [false],
			trackPhotos: [false],
			trackLocation: [false],
			trackWeather: [false]
		});

		// Update duration validation based on type
		this.customTrackerForm.get('durationType')?.valueChanges.pipe(
			takeUntil(this.destroy$)
		).subscribe(type => {
			const durationControl = this.customTrackerForm.get('durationDays');
			const ongoingControl = this.customTrackerForm.get('isOngoing');

			if (type === 'ongoing') {
				durationControl?.clearValidators();
				ongoingControl?.setValue(true);
			} else {
				durationControl?.setValidators([Validators.required, Validators.min(1), Validators.max(365)]);
				ongoingControl?.setValue(false);
			}
			durationControl?.updateValueAndValidity();
		});
	}

	// Template Selection Methods
	selectCategory(category: TrackerCategory) {
		this.selectedCategory = category;
		this.logging.debug('Category selected', { category });
	}

	getTemplatesForCategory(category: TrackerCategory) {
		return this.configService.getTemplatesByCategory(category);
	}



	// Toggle tracker selection (like onboarding)
	toggleTracker(template: any) {
		// Check for duplicates
		if (this.isTemplateAlreadyAdded(template)) {
			this.showToastMessage(`You already have a "${template.name}" tracker`);
			return;
		}

		const trackerId = template.id;

		if (this.selectedTrackers[trackerId]) {
			// Deselect tracker
			delete this.selectedTrackers[trackerId];
		} else {
			// Select tracker with default settings
			this.selectedTrackers[trackerId] = {
				template: template,
				target: template.target || 1,
				frequency: template.frequency || TrackerFrequency.DAILY,
				isOngoing: false,
				duration: 28
			};
		}
	}

	// Check if tracker is selected
	isTrackerSelected(trackerId: string): boolean {
		return !!this.selectedTrackers[trackerId];
	}

	// Get current target for a tracker
	getTrackerTarget(trackerId: string): number {
		return this.selectedTrackers[trackerId]?.target || 1;
	}

	// Update tracker target
	updateTrackerTarget(trackerId: string, change: number) {
		if (this.selectedTrackers[trackerId]) {
			const newTarget = Math.max(1, this.selectedTrackers[trackerId].target + change);
			this.selectedTrackers[trackerId].target = newTarget;
		}
	}

	// Check if tracker is in ongoing mode
	isTrackerOngoing(trackerId: string): boolean {
		return this.selectedTrackers[trackerId]?.isOngoing || false;
	}

	// Set tracker mode (challenge vs ongoing)
	setTrackerMode(trackerId: string, isOngoing: boolean) {
		if (this.selectedTrackers[trackerId]) {
			this.selectedTrackers[trackerId].isOngoing = isOngoing;
		}
	}

	// Get tracker duration
	getTrackerDuration(trackerId: string): number {
		return this.selectedTrackers[trackerId]?.duration || 28;
	}

	getTrackerFrequency(trackerId: string): TrackerFrequency {
		return this.selectedTrackers[trackerId]?.frequency || TrackerFrequency.DAILY;
	}

	updateTrackerFrequency(trackerId: string, frequency: TrackerFrequency) {
		if (this.selectedTrackers[trackerId]) {
			this.selectedTrackers[trackerId].frequency = frequency;
		}
	}

	setCustomFrequency(frequency: TrackerFrequency) {
		this.customTrackerForm.patchValue({ frequency });
	}

	// Update tracker duration
	updateTrackerDuration(trackerId: string, change: number) {
		if (this.selectedTrackers[trackerId]) {
			const newDuration = Math.max(7, Math.min(365, this.selectedTrackers[trackerId].duration + change));
			this.selectedTrackers[trackerId].duration = newDuration;
		}
	}

	// Set specific duration
	setTrackerDuration(trackerId: string, days: number) {
		if (this.selectedTrackers[trackerId]) {
			this.selectedTrackers[trackerId].duration = days;
		}
	}

	// Inline duration editing methods
	isEditingDuration(trackerId: string): boolean {
		return this.editingDuration[trackerId] || false;
	}

	startEditingDuration(trackerId: string) {
		this.editingDuration[trackerId] = true;
		// Focus the input after view update
		setTimeout(() => {
			const input = document.querySelector(`input[type="number"]`) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		}, 10);
	}

	finishEditingDuration(trackerId: string, event: any) {
		const value = parseInt(event.target.value);
		if (this.selectedTrackers[trackerId] && value >= 1 && value <= 365) {
			this.selectedTrackers[trackerId].duration = value;
		}
		this.editingDuration[trackerId] = false;
	}

	// Target editing methods
	isEditingTarget(trackerId: string): boolean {
		return this.editingTarget[trackerId] || false;
	}

	startEditingTarget(trackerId: string) {
		this.editingTarget[trackerId] = true;
		// Focus the input after view update
		setTimeout(() => {
			const input = document.querySelector(`input[type="number"]`) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		}, 10);
	}

	finishEditingTarget(trackerId: string, event: any) {
		const value = parseInt(event.target.value);
		if (this.selectedTrackers[trackerId] && value >= 1 && value <= 1000) {
			this.selectedTrackers[trackerId].target = value;
		}
		this.editingTarget[trackerId] = false;
	}

	// Get duration description
	getDurationDescription(days: number): string {
		if (days <= 7) return "Perfect for trying new habits";
		if (days <= 21) return "Great for building routine";
		if (days <= 30) return "Ideal for habit formation";
		if (days <= 90) return "Excellent for lasting change";
		return "Long-term commitment";
	}

	// Get frequency text
	getFrequencyText(frequency: TrackerFrequency): string {
		switch (frequency) {
			case TrackerFrequency.DAILY: return 'daily';
			case TrackerFrequency.WEEKLY: return 'weekly';
			case TrackerFrequency.MONTHLY: return 'monthly';
			default: return 'daily';
		}
	}

	// Get frequency label
	getFrequencyLabel(frequency: TrackerFrequency): string {
		switch (frequency) {
			case TrackerFrequency.DAILY: return 'Daily';
			case TrackerFrequency.WEEKLY: return 'Weekly';
			case TrackerFrequency.MONTHLY: return 'Monthly';
			default: return 'Daily';
		}
	}

	// Check if any tracker is selected
	hasSelectedTracker(): boolean {
		return Object.keys(this.selectedTrackers).length > 0;
	}

	// Create the selected tracker
	async createSelectedTracker() {
		const selectedIds = Object.keys(this.selectedTrackers);
		if (selectedIds.length === 0) return;

		this.isLoading = true;

		try {
			const trackerId = selectedIds[0]; // Take first selected
			const selection = this.selectedTrackers[trackerId];
			const template = selection.template;

			this.logging.info('User creating tracker from template', {
				templateId: template.id,
				templateName: template.name,
				customizations: {
					target: selection.target,
					isOngoing: selection.isOngoing,
					duration: selection.duration
				}
			});

			// Get base tracker data from template
			const baseTrackerData = this.configService.createTrackerFromTemplate(template.id, 'current-user-id');

			if (!baseTrackerData) {
				throw new Error(`Template ${template.id} not found`);
			}

			// Get notification times for this tracker
			const trackerTimes = this.getTrackerNotificationTimes(template.id);

			// Apply user customizations
			const customizedTrackerData = {
				...baseTrackerData,
				target: selection.target,
				frequency: selection.frequency,
				isOngoing: selection.isOngoing,
				duration: selection.isOngoing ? null : selection.duration,
				config: {
					...baseTrackerData.config,
					reminderEnabled: trackerTimes.length > 0,
					reminderTimes: trackerTimes.length > 0 ? [...trackerTimes] : undefined
				}
			};

			// Create tracker using TrackerService
			const createdTrackerId = await this.trackerService.createTracker(customizedTrackerData);

			this.logging.info('Tracker created from template', {
				trackerId: createdTrackerId,
				templateId: template.id,
				customizations: {
					target: selection.target,
					isOngoing: selection.isOngoing,
					duration: selection.duration
				}
			});

			// Navigate back with success message
			this.router.navigate(['/tabs/tracker'], {
				queryParams: { message: `${template.name} tracker added successfully!` }
			});

		} catch (error) {
			this.logging.error('Failed to create tracker from template', { error });
			const appError = this.errorHandling.createAppError(error, 'CREATE_TRACKER_FROM_TEMPLATE');
			this.showToastMessage(appError.userMessage);
		} finally {
			this.isLoading = false;
		}
	}

	// Check if template is already added
	isTemplateAlreadyAdded(template: any): boolean {
		const templateName = template.name.toLowerCase().trim();
		return this.existingTrackerNames.includes(templateName);
	}



	// Custom Tracker Methods
	async createCustomTracker() {
		if (this.customTrackerForm.invalid) {
			this.logging.warn('Custom tracker form is invalid', {
				errors: this.customTrackerForm.errors
			});
			this.showToastMessage('Please fill in all required fields');
			return;
		}

		const formValue = this.customTrackerForm.value;

		// Check for duplicate name
		const trackerName = formValue.name.toLowerCase().trim();
		if (this.existingTrackerNames.includes(trackerName)) {
			this.showToastMessage(`You already have a tracker named "${formValue.name}"`);
			return;
		}

		try {
			this.isLoading = true;

			this.logging.info('Creating custom tracker', { name: formValue.name });

			const trackerData = {
				userId: 'current-user-id', // This would come from AuthService in real implementation
				name: formValue.name,
				category: formValue.category,
				type: formValue.type,
				unit: formValue.unit,
				target: formValue.target,
				color: formValue.color,
				icon: formValue.icon,
				frequency: formValue.frequency,
				durationDays: formValue.durationType === 'ongoing' ? 365 : formValue.durationDays,
				startDate: new Date(),
				endDate: new Date(Date.now() + (formValue.durationType === 'ongoing' ? 365 : formValue.durationDays) * 24 * 60 * 60 * 1000),
				isCompleted: false,
				timesExtended: 0,
				isOngoing: formValue.durationType === 'ongoing',
				isActive: true,
				isDefault: false,
				config: {
					reminderEnabled: this.customNotificationTimes.length > 0,
					reminderTimes: this.customNotificationTimes.length > 0 ? [...this.customNotificationTimes] : undefined,
					loggingFields: {
						value: true as true,
						// Add enabled fields
						...(formValue.trackMood && { mood: true }),
						...(formValue.trackEnergy && { energy: true }),
						...(formValue.trackDuration && { duration: true }),
						...(formValue.trackIntensity && { intensity: true }),
						...(formValue.trackQuality && { quality: true }),
						...(formValue.trackNotes && { notes: true }),
						...(formValue.trackTags && { tags: true }),
						...(formValue.trackSocialContext && { socialContext: true }),
						...(formValue.trackPhotos && { photos: true }),
						...(formValue.trackLocation && { location: true }),
						...(formValue.trackWeather && { weather: true })
					},
					requirePhotos: formValue.trackPhotos
				}
			};

			const trackerId = await this.trackerService.createTracker(trackerData);

			this.logging.info('Custom tracker created', { trackerId });

			// Navigate back with success
			this.router.navigate(['/tabs/tracker'], {
				queryParams: { message: `${formValue.name} tracker created successfully!` }
			});

		} catch (error) {
			this.logging.error('Failed to create custom tracker', { error });
			const appError = this.errorHandling.createAppError(error, 'CREATE_CUSTOM_TRACKER');
			this.showToastMessage(appError.userMessage);
		} finally {
			this.isLoading = false;
		}
	}

	// Utility Methods
	goBack() {
		this.logging.info('User navigating back from add tracker page');
		this.router.navigate(['/tabs/tracker']);
	}

	private showToastMessage(message: string) {
		this.toastMessage = message;
		this.showToast = true;
	}

	onToastDismiss() {
		this.showToast = false;
		this.toastMessage = '';
	}

	// Form validation helpers
	isFieldInvalid(fieldName: string): boolean {
		const field = this.customTrackerForm.get(fieldName);
		return !!(field && field.invalid && (field.dirty || field.touched));
	}

	getFieldError(fieldName: string): string {
		const field = this.customTrackerForm.get(fieldName);
		if (field?.errors) {
			if (field.errors['required']) return `${fieldName} is required`;
			if (field.errors['minlength']) return `${fieldName} is too short`;
			if (field.errors['maxlength']) return `${fieldName} is too long`;
			if (field.errors['min']) return `${fieldName} must be at least ${field.errors['min'].min}`;
			if (field.errors['max']) return `${fieldName} must be at most ${field.errors['max'].max}`;
		}
		return '';
	}

	// Category helper methods
	getCategoryColor(category: TrackerCategory): string {
		const colors = {
			[TrackerCategory.MIND]: '#3B82F6',
			[TrackerCategory.BODY]: '#10B981',
			[TrackerCategory.SOUL]: '#8B5CF6',
			[TrackerCategory.BEAUTY]: '#EC4899',
			[TrackerCategory.MOOD]: '#F59E0B',
			[TrackerCategory.CUSTOM]: '#6B7280'
		};
		return colors[category] || '#6B7280';
	}

	getCategoryIcon(category: TrackerCategory): string {
		const icons = {
			[TrackerCategory.MIND]: 'brain-outline',
			[TrackerCategory.BODY]: 'fitness-outline',
			[TrackerCategory.SOUL]: 'heart-outline',
			[TrackerCategory.BEAUTY]: 'flower-outline',
			[TrackerCategory.MOOD]: 'happy-outline',
			[TrackerCategory.CUSTOM]: 'settings-outline'
		};
		return icons[category] || 'checkmark-circle-outline';
	}

	// Duration control methods
	updateDuration(change: number) {
		const currentValue = this.customTrackerForm.get('durationDays')?.value || 28;
		const newValue = Math.max(7, Math.min(365, currentValue + change));
		this.customTrackerForm.get('durationDays')?.setValue(newValue);
	}

	setDuration(days: number) {
		this.customTrackerForm.get('durationDays')?.setValue(days);
	}

	// Convert FontAwesome icons to emojis (matching onboarding style)
	getTemplateEmoji(iconName: string): string {
		const iconMap: { [key: string]: string } = {
			// Mind icons
			'fa-brain': '🧠',
			'fa-bullseye': '🎯',
			'fa-graduation-cap': '🎓',
			'fa-leaf': '🍃',

			// Body icons
			'fa-dumbbell': '💪',
			'fa-bed': '😴',
			'fa-glass-water': '💧',
			'fa-walking': '👟',
			'fa-child-reaching': '🤸',

			// Soul icons
			'fa-heart': '❤️',
			'fa-praying-hands': '🙏',
			'fa-users': '👥',
			'fa-hand-holding-heart': '💝',

			// Beauty icons
			'fa-sparkles': '✨',
			'fa-spa': '🧴',
			'fa-mirror': '🪞',
			'fa-cut': '💇',

			// Mood icons
			'fa-face-smile': '😊',
			'fa-bolt': '⚡',
			'fa-heart-pulse': '💗',

			// Default fallback
			'default': '⭐'
		};

		return iconMap[iconName] || iconMap['default'];
	}

	// Per-tracker notification time management methods
	addTrackerNotificationTime(trackerId: string) {
		const newTime = this.trackerNewNotificationTime[trackerId];
		if (newTime && !this.getTrackerNotificationTimes(trackerId).includes(newTime)) {
			if (!this.trackerNotificationTimes[trackerId]) {
				this.trackerNotificationTimes[trackerId] = [];
			}
			this.trackerNotificationTimes[trackerId].push(newTime);
			this.trackerNotificationTimes[trackerId].sort();
			this.trackerNewNotificationTime[trackerId] = '';

			this.logging.debug('Tracker notification time added', {
				trackerId,
				time: newTime,
				total: this.trackerNotificationTimes[trackerId].length
			});

			this.showToastMessage(`Notification time ${this.formatTime(newTime)} added`);
		}
	}

	removeTrackerNotificationTime(trackerId: string, index: number) {
		const times = this.getTrackerNotificationTimes(trackerId);
		if (index >= 0 && index < times.length) {
			const removedTime = this.trackerNotificationTimes[trackerId].splice(index, 1)[0];
			this.logging.debug('Tracker notification time removed', {
				trackerId,
				time: removedTime,
				remaining: this.trackerNotificationTimes[trackerId].length
			});

			this.showToastMessage(`Notification time ${this.formatTime(removedTime)} removed`);
		}
	}

	addTrackerPresetTime(trackerId: string, time: string) {
		if (!this.getTrackerNotificationTimes(trackerId).includes(time)) {
			if (!this.trackerNotificationTimes[trackerId]) {
				this.trackerNotificationTimes[trackerId] = [];
			}
			this.trackerNotificationTimes[trackerId].push(time);
			this.trackerNotificationTimes[trackerId].sort();

			this.showToastMessage(`Notification time ${this.formatTime(time)} added`);
		}
	}

	getTrackerNotificationTimes(trackerId: string): string[] {
		return this.trackerNotificationTimes[trackerId] || [];
	}

	// Custom tracker notification time management methods
	addCustomNotificationTime() {
		if (this.customNewNotificationTime && !this.customNotificationTimes.includes(this.customNewNotificationTime)) {
			const timeToAdd = this.customNewNotificationTime;
			this.customNotificationTimes.push(timeToAdd);
			this.customNotificationTimes.sort();
			this.customNewNotificationTime = '';

			this.logging.debug('Custom notification time added', {
				time: timeToAdd,
				total: this.customNotificationTimes.length
			});

			this.showToastMessage(`Notification time ${this.formatTime(timeToAdd)} added`);
		}
	}

	removeCustomNotificationTime(index: number) {
		if (index >= 0 && index < this.customNotificationTimes.length) {
			const removedTime = this.customNotificationTimes.splice(index, 1)[0];
			this.logging.debug('Custom notification time removed', {
				time: removedTime,
				remaining: this.customNotificationTimes.length
			});

			this.showToastMessage(`Notification time ${this.formatTime(removedTime)} removed`);
		}
	}

	addCustomPresetTime(time: string) {
		if (!this.customNotificationTimes.includes(time)) {
			this.customNotificationTimes.push(time);
			this.customNotificationTimes.sort();

			this.logging.debug('Custom preset notification time added', {
				time,
				total: this.customNotificationTimes.length
			});

			this.showToastMessage(`Notification time ${this.formatTime(time)} added`);
		}
	}

	formatTime(time: string): string {
		const [hours, minutes] = time.split(':');
		const hour = parseInt(hours);
		const period = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour}:${minutes} ${period}`;
	}

	getPresetTimes() {
		return [
			{ label: '8:00 AM', value: '08:00' },
			{ label: '12:00 PM', value: '12:00' },
			{ label: '6:00 PM', value: '18:00' },
			{ label: '9:00 PM', value: '21:00' }
		];
	}
} 