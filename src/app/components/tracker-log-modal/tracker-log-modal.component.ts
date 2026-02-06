import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonModal,
	IonContent,
	IonHeader,
	IonFooter,
	IonRange,
	IonSelect,
	IonSelectOption
} from '@ionic/angular/standalone';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';

// Services
import { LoggingModalService } from '../../services/logging-modal.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { LoggingService } from '../../services/logging.service';
import { TrackerService } from '../../services/tracker.service';

// Models
import { Tracker, TrackerEntry, TrackerType, TrackerCategory } from '../../models/tracker.interface';

interface LoggingFormData {
	// Core fields
	value: number;
	date: string;
	time: string;

	// Optional fields
	mood?: number;
	energy?: number;
	notes?: string;
	duration?: number;
	intensity?: number;
	quality?: number;
	tags?: string[];
	socialContext?: 'alone' | 'with-others' | 'group';
	photos?: string[];

	// New Context Fields
	location?: string; // Manual address input
	weatherTemp?: number;
	weatherCondition?: string;

	// UI state
	customDateEnabled: boolean;
	customTimeEnabled: boolean;
}

interface UIErrorState {
	hasError: boolean;
	errorMessage: string;
	canRetry: boolean;
	retryAction?: () => void;
}

import { CountUpDirective } from '../../directives/count-up.directive';

@Component({
	selector: 'app-tracker-log-modal',
	templateUrl: './tracker-log-modal.component.html',
	styleUrls: ['./tracker-log-modal.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IonModal,
		IonContent,
		IonHeader,
		IonFooter,
		IonRange,
		IonSelect,
		IonSelectOption,
		CountUpDirective
	]
})
export class TrackerLogModalComponent implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// Current tracker from global service
	tracker: Tracker | null = null;
	isOpen = false;

	// Available trackers for switching
	activeTrackers: Tracker[] = [];

	// Form state
	loggingForm: LoggingFormData = {
		value: 1,
		date: '',
		time: '',
		mood: 5,
		energy: 3,
		notes: '',
		duration: 10,
		intensity: 5,
		quality: 5,
		tags: [],
		socialContext: 'alone',
		customDateEnabled: false,
		customTimeEnabled: false
	};

	// UI state
	isSubmittingEntry = false;
	loggingErrorState: UIErrorState = {
		hasError: false,
		errorMessage: '',
		canRetry: false
	};

	formValidation = {
		isValid: false,
		errors: [] as string[]
	};

	constructor(
		private loggingModalService: LoggingModalService,
		private errorHandling: ErrorHandlingService,
		private logging: LoggingService,
		private trackerService: TrackerService
	) { }

	ngOnInit() {
		// Subscribe to global modal state
		this.loggingModalService.modalState$
			.pipe(takeUntil(this.destroy$))
			.subscribe(state => {
				this.isOpen = state.isOpen;

				// Only update tracker if we don't have one or if the modal is opening fresh
				if (state.isOpen && state.tracker) {
					this.tracker = state.tracker;
					this.resetLoggingForm(state.tracker);
				} else {
					this.isOpen = state.isOpen;
					this.tracker = state.tracker;
				}
			});

		// Load active trackers for switching
		this.loadActiveTrackers();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	async loadActiveTrackers() {
		try {
			// Get all trackers and filter for active ones (UserTrackers returns full list)
			const allTrackers = await firstValueFrom(this.trackerService.getUserTrackers());
			// Filter active non-completed trackers
			this.activeTrackers = allTrackers.filter(t => t.isActive && !t.isCompleted);
		} catch (error) {
			this.logging.error('Failed to load active trackers in modal', error);
		}
	}

	onTrackerSelectChange(event: any) {
		const newTrackerId = event.detail.value;
		const selectedTracker = this.activeTrackers.find(t => t.id === newTrackerId);

		if (selectedTracker) {
			this.tracker = selectedTracker;
			this.resetLoggingForm(selectedTracker);
		}
	}

	closeModal() {
		this.loggingModalService.closeLogModal();
		this.resetLoggingForm();
	}

	private resetLoggingForm(tracker?: Tracker) {
		const today = this.getTodayISOString();
		const currentTime = this.getCurrentTimeString();

		this.loggingForm = {
			value: tracker?.target || 1,
			date: today,
			time: currentTime,
			mood: 5,
			energy: 3,
			notes: '',
			duration: 10,
			intensity: 5,
			quality: 5,
			tags: [],
			socialContext: 'alone',
			photos: [],
			customDateEnabled: false,
			customTimeEnabled: false
		};

		this.loggingErrorState = {
			hasError: false,
			errorMessage: '',
			canRetry: false
		};

		this.validateForm();
	}

	private validateForm(): boolean {
		const errors: string[] = [];

		if (this.loggingForm.value === null || this.loggingForm.value === undefined) {
			errors.push('Value is required');
		}

		if (!this.loggingForm.date) {
			errors.push('Date is required');
		}

		this.formValidation = {
			isValid: errors.length === 0,
			errors: errors
		};

		return this.formValidation.isValid;
	}

	async logTrackerEntry() {
		if (!this.validateForm()) {
			this.logging.warn('Form validation failed');
			return;
		}

		if (!this.tracker) {
			this.logging.error('No tracker selected for logging');
			this.loggingErrorState = {
				hasError: true,
				errorMessage: 'No tracker selected. Please try again.',
				canRetry: false
			};
			return;
		}

		// Store tracker reference to avoid null reference during async operations
		const currentTracker = this.tracker;

		try {
			this.isSubmittingEntry = true;
			this.loggingErrorState.hasError = false;

			// Combine date and time into a proper datetime string
			const entryDateTime = this.loggingForm.customTimeEnabled
				? `${this.loggingForm.date}T${this.loggingForm.time}:00`
				: `${this.loggingForm.date}T${this.getCurrentTimeString()}:00`;

			// Map Weather Data
			let weatherData = undefined;
			if (this.loggingForm.weatherCondition || this.loggingForm.weatherTemp) {
				weatherData = {
					condition: this.loggingForm.weatherCondition || 'Unknown',
					temperature: this.loggingForm.weatherTemp || 0
				};
			}

			// Map Location Data
			let locationData = undefined;
			if (this.loggingForm.location) {
				locationData = {
					latitude: 0, // Default since manual entry
					longitude: 0,
					address: this.loggingForm.location
				};
			}

			const entry: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'> = {
				trackerId: currentTracker.id,
				userId: '', // Will be set by service
				date: entryDateTime,
				value: this.loggingForm.value,
				mood: this.loggingForm.mood,
				energy: this.loggingForm.energy,
				notes: this.loggingForm.notes || undefined,
				duration: this.loggingForm.duration,
				intensity: this.loggingForm.intensity,
				quality: this.loggingForm.quality,
				tags: this.loggingForm.tags?.length ? this.loggingForm.tags : undefined,
				socialContext: this.loggingForm.socialContext,
				photos: this.loggingForm.photos?.length ? this.loggingForm.photos : undefined,
				weather: weatherData,
				location: locationData
			};

			// Use the global service to handle all logging logic
			await this.loggingModalService.logEntry(entry);

			this.logging.info('Entry logged successfully via global service', { trackerId: currentTracker.id });

		} catch (error) {
			this.logging.error('Failed to log tracker entry', { error });

			this.loggingErrorState = {
				hasError: true,
				errorMessage: 'Failed to log entry. Please try again.',
				canRetry: true,
				retryAction: () => this.logTrackerEntry()
			};
		} finally {
			this.isSubmittingEntry = false;
		}
	}

	async retryLogging() {
		if (this.loggingErrorState.retryAction) {
			await this.loggingErrorState.retryAction();
		}
	}

	getValueInputConfig() {
		if (!this.tracker) {
			return { min: 0, max: 100, step: 1 };
		}

		switch (this.tracker.type) {
			case TrackerType.RATING:
				return { min: 1, max: 5, step: 1 };
			case TrackerType.SCALE:
				return { min: 1, max: 10, step: 1 };
			case TrackerType.BOOLEAN:
				return { min: 0, max: 1, step: 1 };
			case TrackerType.COUNT:
				return { min: 0, max: this.tracker.target * 2, step: 1 };
			case TrackerType.DURATION:
				return { min: 0, max: 240, step: 5 };
			default:
				return { min: 0, max: this.tracker.target * 2, step: 1 };
		}
	}

	getValueLabel(): string {
		if (!this.tracker) return 'Value';

		switch (this.tracker.type) {
			case TrackerType.RATING:
				return 'Rating (1-5)';
			case TrackerType.SCALE:
				return 'Scale (1-10)';
			case TrackerType.BOOLEAN:
				return this.loggingForm.value ? 'Completed' : 'Not Completed';
			case TrackerType.COUNT:
				return `Count (${this.tracker.unit})`;
			case TrackerType.DURATION:
				return 'Duration (minutes)';
			default:
				return `${this.tracker.name} Value`;
		}
	}

	formatValue(value: number): string {
		if (!this.tracker) return value.toString();

		if (this.tracker.type === TrackerType.BOOLEAN) {
			return value ? 'Yes' : 'No';
		}

		if (this.tracker.unit) {
			return `${value} ${this.tracker.unit}`;
		}

		return value.toString();
	}

	getTrackerIcon(tracker: Tracker): string {
		return tracker.icon || 'fa-chart-line';
	}

	getTrackerColor(tracker: Tracker): string {
		return tracker.color || '#6b7280';
	}

	getCategoryLabel(category: string | null | undefined): string {
		if (!category) return 'General';
		return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
	}

	getTodayISOString(): string {
		return new Date().toISOString().split('T')[0];
	}

	getCurrentTimeString(): string {
		const now = new Date();
		const hours = now.getHours().toString().padStart(2, '0');
		const minutes = now.getMinutes().toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	// Social context methods
	getSocialContextOptions(): Array<{ value: 'alone' | 'with-others' | 'group', label: string, icon: string }> {
		return [
			{ value: 'alone', label: 'Alone', icon: 'fa-solid fa-user' },
			{ value: 'with-others', label: 'With Others', icon: 'fa-solid fa-user-group' },
			{ value: 'group', label: 'Group', icon: 'fa-solid fa-users' }
		];
	}

	getSocialContextButtonClass(value: 'alone' | 'with-others' | 'group'): string {
		const baseClass = 'flex flex-col items-center justify-center border-2 ';
		if (this.loggingForm.socialContext === value) {
			return baseClass + 'border-indigo-500 bg-indigo-100 text-indigo-800';
		}
		return baseClass + 'border-indigo-200 bg-white text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50';
	}

	// Tag management methods
	addTag(tagValue: string) {
		const tag = tagValue.trim();
		if (tag && !this.loggingForm.tags?.includes(tag)) {
			this.loggingForm.tags = this.loggingForm.tags || [];
			this.loggingForm.tags.push(tag);
		}
	}

	weatherOptions = ['Sunny', 'Cloudy', 'Rainy', 'Snowy', 'Windy', 'Stormy', 'Clear', 'Foggy'];

	addPhoto() {
		this.loggingForm.photos = this.loggingForm.photos || [];
		// Mock photo add - in real app this would trigger file picker
		this.loggingForm.photos.push('https://via.placeholder.com/150');
	}

	removePhoto(index: number) {
		if (this.loggingForm.photos) {
			this.loggingForm.photos.splice(index, 1);
		}
	}

	removeTag(index: number) {
		if (this.loggingForm.tags) {
			this.loggingForm.tags.splice(index, 1);
		}
	}

	// Value manipulation methods
	incrementValue() {
		const config = this.getValueInputConfig();
		const newValue = (this.loggingForm.value || 0) + config.step;
		if (newValue <= config.max) {
			this.loggingForm.value = newValue;
		}
	}

	decrementValue() {
		const config = this.getValueInputConfig();
		const newValue = (this.loggingForm.value || 0) - config.step;
		if (newValue >= config.min) {
			this.loggingForm.value = newValue;
		}
	}

	getMoodEmoji(mood?: number): string {
		if (!mood) return '😐';
		if (mood >= 9) return '🤩';
		if (mood >= 7) return '😊';
		if (mood >= 5) return '😐';
		if (mood >= 3) return '😔';
		return '😞';
	}

	// Enhanced shouldShowField to include all possible fields
	shouldShowField(fieldName: string): boolean {
		if (!this.tracker) {
			return false;
		}

		// Special handling for customDate
		if (fieldName === 'customDate') {
			return true; // Always allow custom date selection
		}

		// PRIORITY 1: Check if tracker has specific logging configuration
		if (this.tracker.config?.loggingFields) {
			const config = this.tracker.config.loggingFields as any;
			const fieldConfig = config[fieldName as keyof typeof config];

			// If explicitly configured, use that setting
			if (fieldConfig !== undefined) {
				return typeof fieldConfig === 'boolean' ? fieldConfig : !!fieldConfig;
			}
		}

		// PRIORITY 2: Intelligent Defaults based on Tracker Category
		// If configuration is missing, we use smart defaults based on the type of tracker
		const category = this.tracker.category;
		const universalDefaults = ['notes']; // Always show notes by default

		if (universalDefaults.includes(fieldName)) {
			return true;
		}

		// Default logic based on TrackerCategory
		switch (category) {
			case TrackerCategory.BODY: // Exercise, Health
				if (['energy', 'intensity', 'photos', 'socialContext'].includes(fieldName)) return true;
				break;
			case TrackerCategory.MIND: // Meditation, Learning
				if (['mood', 'quality', 'tags'].includes(fieldName)) return true;
				break;
			case TrackerCategory.SOUL: // Gratitude, Social
				if (['mood', 'socialContext', 'quality'].includes(fieldName)) return true;
				break;
			case TrackerCategory.BEAUTY: // Skincare, Self-care
				if (['photos', 'quality', 'mood'].includes(fieldName)) return true;
				break;
			case TrackerCategory.MOOD: // Mood tracking
				if (['energy', 'socialContext', 'tags', 'photos'].includes(fieldName)) return true;
				break;
		}

		// Legacy fallback for really old data or other types
		if (!this.tracker.config?.loggingFields && ['tags', 'photos', 'mood'].includes(fieldName)) {
			return true;
		}

		return false;
	}
}