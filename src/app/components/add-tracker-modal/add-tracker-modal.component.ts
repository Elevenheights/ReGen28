import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonModal,
	IonInput,
	IonTextarea,
	IonToggle,
	IonSelect,
	IonSelectOption,
	IonRange,
	IonSpinner
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';

// Services
import { TrackerService } from '../../services/tracker.service';
import { ConfigService, DefaultTrackerTemplate } from '../../services/config.service';
import { LoggingService } from '../../services/logging.service';
import { ToastService } from '../../services/toast.service';

// Models
import { Tracker, TrackerCategory, TrackerType, TrackerFrequency } from '../../models/tracker.interface';

type CreationStep = 'category' | 'template' | 'customize' | 'duration';

interface CategoryOption {
	value: TrackerCategory;
	label: string;
	icon: string;
	color: string;
	description: string;
}

@Component({
	selector: 'app-add-tracker-modal',
	templateUrl: './add-tracker-modal.component.html',
	styleUrls: ['./add-tracker-modal.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IonModal,
		IonInput,
		IonTextarea,
		IonToggle,
		IonSelect,
		IonSelectOption,
		IonRange,
		IonSpinner
	]
})
export class AddTrackerModalComponent implements OnDestroy {
	private readonly trackerService = inject(TrackerService);
	private readonly configService = inject(ConfigService);
	private readonly logging = inject(LoggingService);
	private readonly toast = inject(ToastService);

	private destroy$ = new Subject<void>();

	// Modal state
	isOpen = false;
	currentStep: CreationStep = 'category';
	isSubmitting = false;

	// Category selection
	categories: CategoryOption[] = [
		{
			value: TrackerCategory.MIND,
			label: 'Mind',
			icon: 'fa-brain',
			color: '#3b82f6',
			description: 'Meditation, focus, learning'
		},
		{
			value: TrackerCategory.BODY,
			label: 'Body',
			icon: 'fa-heart-pulse',
			color: '#10b981',
			description: 'Exercise, sleep, nutrition'
		},
		{
			value: TrackerCategory.SOUL,
			label: 'Soul',
			icon: 'fa-spa',
			color: '#8b5cf6',
			description: 'Gratitude, prayer, connection'
		},
		{
			value: TrackerCategory.BEAUTY,
			label: 'Beauty',
			icon: 'fa-sparkles',
			color: '#ec4899',
			description: 'Skincare, self-care, grooming'
		},
		{
			value: TrackerCategory.CUSTOM,
			label: 'Custom',
			icon: 'fa-plus',
			color: '#f59e0b',
			description: 'Create your own tracker'
		}
	];

	selectedCategory: TrackerCategory | null = null;

	// Template selection
	availableTemplates: DefaultTrackerTemplate[] = [];
	selectedTemplate: DefaultTrackerTemplate | null = null;

	// Tracker form data
	trackerForm = {
		name: '',
		icon: 'fa-circle',
		color: '#6b7280',
		type: TrackerType.COUNT,
		target: 1,
		unit: 'times',
		frequency: TrackerFrequency.DAILY,
		durationDays: 28,
		isOngoing: false,
		reminderEnabled: false,
		reminderTime: '09:00'
	};

	// Type options
	typeOptions = [
		{ value: TrackerType.COUNT, label: 'Count', icon: 'fa-hashtag', description: 'Track a number (steps, glasses, etc.)' },
		{ value: TrackerType.DURATION, label: 'Duration', icon: 'fa-clock', description: 'Track time spent (minutes)' },
		{ value: TrackerType.BOOLEAN, label: 'Yes/No', icon: 'fa-check', description: 'Simple completion tracking' },
		{ value: TrackerType.RATING, label: 'Rating', icon: 'fa-star', description: '1-5 star rating' },
		{ value: TrackerType.SCALE, label: 'Scale', icon: 'fa-sliders', description: '1-10 scale tracking' }
	];

	// Frequency options
	frequencyOptions = [
		{ value: TrackerFrequency.DAILY, label: 'Daily', description: 'Track every day' },
		{ value: TrackerFrequency.WEEKLY, label: 'Weekly', description: 'Track weekly goals' },
		{ value: TrackerFrequency.MONTHLY, label: 'Monthly', description: 'Track monthly goals' }
	];

	// Duration presets
	durationPresets = [
		{ days: 7, label: '7 Days', description: 'Quick challenge' },
		{ days: 14, label: '14 Days', description: 'Two-week habit' },
		{ days: 28, label: '28 Days', description: 'Monthly challenge' },
		{ days: 66, label: '66 Days', description: 'Habit formation' },
		{ days: 100, label: '100 Days', description: 'Century challenge' },
		{ days: -1, label: 'Ongoing', description: 'No end date' }
	];

	// Icon picker state
	showIconPicker = false;
	iconOptions = [
		'fa-brain', 'fa-heart-pulse', 'fa-spa', 'fa-sparkles', 'fa-dumbbell',
		'fa-bed', 'fa-glass-water', 'fa-utensils', 'fa-book', 'fa-pen',
		'fa-music', 'fa-running', 'fa-bicycle', 'fa-pray', 'fa-sun',
		'fa-moon', 'fa-leaf', 'fa-fire', 'fa-bolt', 'fa-star',
		'fa-smile', 'fa-meditation', 'fa-hands-praying', 'fa-face-smile', 'fa-seedling'
	];

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	// Open/Close methods
	open() {
		this.isOpen = true;
		this.resetForm();
	}

	close() {
		this.isOpen = false;
		this.resetForm();
	}

	private resetForm() {
		this.currentStep = 'category';
		this.selectedCategory = null;
		this.selectedTemplate = null;
		this.availableTemplates = [];
		this.showIconPicker = false;

		this.trackerForm = {
			name: '',
			icon: 'fa-circle',
			color: '#6b7280',
			type: TrackerType.COUNT,
			target: 1,
			unit: 'times',
			frequency: TrackerFrequency.DAILY,
			durationDays: 28,
			isOngoing: false,
			reminderEnabled: false,
			reminderTime: '09:00'
		};
	}

	// Navigation
	get canGoBack(): boolean {
		return this.currentStep !== 'category';
	}

	get canGoNext(): boolean {
		switch (this.currentStep) {
			case 'category':
				return this.selectedCategory !== null;
			case 'template':
				return true; // Can skip template selection
			case 'customize':
				return this.trackerForm.name.trim().length > 0;
			case 'duration':
				return true;
			default:
				return false;
		}
	}

	get stepTitle(): string {
		switch (this.currentStep) {
			case 'category': return 'Choose Category';
			case 'template': return 'Select Template';
			case 'customize': return 'Customize Tracker';
			case 'duration': return 'Set Duration';
			default: return 'Add Tracker';
		}
	}

	get stepIndex(): number {
		const steps: CreationStep[] = ['category', 'template', 'customize', 'duration'];
		return steps.indexOf(this.currentStep);
	}

	goBack() {
		switch (this.currentStep) {
			case 'template':
				this.currentStep = 'category';
				break;
			case 'customize':
				this.currentStep = 'template';
				break;
			case 'duration':
				this.currentStep = 'customize';
				break;
		}
	}

	goNext() {
		switch (this.currentStep) {
			case 'category':
				this.loadTemplatesForCategory();
				this.currentStep = 'template';
				break;
			case 'template':
				this.currentStep = 'customize';
				break;
			case 'customize':
				this.currentStep = 'duration';
				break;
			case 'duration':
				this.createTracker();
				break;
		}
	}

	// Category selection
	selectCategory(category: TrackerCategory) {
		this.selectedCategory = category;
		const categoryData = this.categories.find(c => c.value === category);
		if (categoryData) {
			this.trackerForm.color = categoryData.color;
			this.trackerForm.icon = categoryData.icon;
		}
	}

	getCategoryClass(category: TrackerCategory): string {
		if (this.selectedCategory === category) {
			return 'ring-2 ring-offset-2 scale-[1.02]';
		}
		return 'hover:shadow-md';
	}

	// Template handling
	private loadTemplatesForCategory() {
		if (!this.selectedCategory) return;

		// Get templates from config service
		const templates = this.configService.getDefaultTrackerTemplates();
		this.availableTemplates = templates.filter((t: DefaultTrackerTemplate) =>
			t.category.toLowerCase() === this.selectedCategory?.toLowerCase()
		);

		this.logging.info('Loaded templates for category', {
			category: this.selectedCategory,
			count: this.availableTemplates.length
		});
	}

	selectTemplate(template: DefaultTrackerTemplate) {
		this.selectedTemplate = template;

		// Populate form from template
		this.trackerForm.name = template.name;
		this.trackerForm.icon = template.icon;
		this.trackerForm.color = template.color;
		this.trackerForm.type = template.type as TrackerType;
		this.trackerForm.target = template.target;
		this.trackerForm.unit = template.unit;
		this.trackerForm.frequency = template.frequency as TrackerFrequency;

		this.logging.info('Selected template', { templateName: template.name });
	}

	skipTemplate() {
		this.selectedTemplate = null;
		this.goNext();
	}

	// Duration selection
	selectDuration(days: number) {
		if (days === -1) {
			this.trackerForm.isOngoing = true;
			this.trackerForm.durationDays = 0;
		} else {
			this.trackerForm.isOngoing = false;
			this.trackerForm.durationDays = days;
		}
	}

	isDurationSelected(days: number): boolean {
		if (days === -1) {
			return this.trackerForm.isOngoing;
		}
		return !this.trackerForm.isOngoing && this.trackerForm.durationDays === days;
	}

	// Icon picker
	toggleIconPicker() {
		this.showIconPicker = !this.showIconPicker;
	}

	selectIcon(icon: string) {
		this.trackerForm.icon = icon;
		this.showIconPicker = false;
	}

	// Create tracker
	async createTracker() {
		if (!this.selectedCategory) {
			this.toast.showError('Please select a category');
			return;
		}

		if (!this.trackerForm.name.trim()) {
			this.toast.showError('Please enter a tracker name');
			return;
		}

		try {
			this.isSubmitting = true;

			const startDate = new Date();
			const endDate = this.trackerForm.isOngoing
				? new Date(9999, 11, 31) // Far future for ongoing
				: new Date(startDate.getTime() + this.trackerForm.durationDays * 24 * 60 * 60 * 1000);

			const trackerData: Omit<Tracker, 'id' | 'createdAt' | 'updatedAt'> = {
				userId: '', // Will be set by service
				name: this.trackerForm.name.trim(),
				category: this.selectedCategory,
				type: this.trackerForm.type,
				color: this.trackerForm.color,
				icon: this.trackerForm.icon,
				target: this.trackerForm.target,
				unit: this.trackerForm.unit,
				frequency: this.trackerForm.frequency,
				durationDays: this.trackerForm.durationDays,
				startDate: startDate,
				endDate: endDate,
				isCompleted: false,
				timesExtended: 0,
				isOngoing: this.trackerForm.isOngoing,
				isActive: true,
				isDefault: false,
				config: {
					reminderEnabled: this.trackerForm.reminderEnabled,
					reminderTime: this.trackerForm.reminderEnabled ? this.trackerForm.reminderTime : undefined
				}
			};

			const trackerId = await this.trackerService.createTracker(trackerData);

			this.logging.info('Tracker created successfully', { trackerId, name: trackerData.name });
			this.toast.showSuccess(`"${trackerData.name}" tracker created!`);

			this.close();
		} catch (error) {
			this.logging.error('Failed to create tracker', { error });
			this.toast.showError('Failed to create tracker. Please try again.');
		} finally {
			this.isSubmitting = false;
		}
	}

	// Utility
	getSelectedCategoryData(): CategoryOption | undefined {
		return this.categories.find(c => c.value === this.selectedCategory);
	}
}
