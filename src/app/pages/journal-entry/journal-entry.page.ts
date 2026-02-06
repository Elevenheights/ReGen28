import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButton,
	IonButtons,
	IonContent,
	IonLabel,
	IonInput,
	IonSelect,
	IonSelectOption,
	IonRange,
	IonDatetime,
	IonFab,
	IonFabButton,
	IonActionSheet
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Services
import { UserService } from '../../services/user.service';
import { LoggingService } from '../../services/logging.service';
import { JournalService } from '../../services/journal.service';
import { ErrorHandlingService } from '../../services/error-handling.service';
import { ToastService } from '../../services/toast.service';

// Models
import { JournalEntry, JournalCategory, JournalPrompt } from '../../models/journal.interface';

// Components
import { RichTextEditorComponent } from '../../components/rich-text-editor';

@Component({
	selector: 'app-journal-entry',
	templateUrl: './journal-entry.page.html',
	styleUrls: ['./journal-entry.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		FormsModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonButtons,
		IonContent,
		IonLabel,
		IonInput,
		IonSelect,
		IonSelectOption,
		IonRange,
		IonDatetime,
		IonFab,
		IonFabButton,
		IonActionSheet,
		RichTextEditorComponent
	]
})
export class JournalEntryPage implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	// Page modes
	mode: 'view' | 'edit' | 'new' = 'new';
	entryId: string | null = null;

	// Form and data
	entryForm!: FormGroup;
	currentEntry: JournalEntry | null = null;
	selectedPrompt: JournalPrompt | null = null;

	// UI state
	isLoading = false;
	isSaving = false;
	isEditing = false;
	selectedTags: string[] = [];
	showAdvanced = false;
	showActionSheet = false;

	// Data
	categories = Object.values(JournalCategory);
	availableTags = [
		'gratitude', 'reflection', 'goals', 'challenges', 'growth',
		'mindfulness', 'relationships', 'work', 'health', 'emotions',
		'achievement', 'learning', 'creativity', 'peace', 'anxiety',
		'joy', 'stress', 'motivation', 'family', 'friends'
	];

	moodOptions = [
		{ value: 1, emoji: '😢', label: 'Very Sad' },
		{ value: 2, emoji: '😔', label: 'Sad' },
		{ value: 3, emoji: '😕', label: 'Down' },
		{ value: 4, emoji: '😐', label: 'Neutral' },
		{ value: 5, emoji: '🙂', label: 'Okay' },
		{ value: 6, emoji: '😊', label: 'Good' },
		{ value: 7, emoji: '😄', label: 'Happy' },
		{ value: 8, emoji: '😆', label: 'Very Happy' },
		{ value: 9, emoji: '😍', label: 'Amazing' },
		{ value: 10, emoji: '🤩', label: 'Incredible' }
	];

	actionSheetButtons = [
		{
			text: 'Save Draft',
			icon: 'save-outline',
			handler: () => this.saveDraft()
		},
		{
			text: 'Delete Entry',
			icon: 'trash-outline',
			role: 'destructive',
			handler: () => this.confirmDelete()
		},
		{
			text: 'Cancel',
			icon: 'close',
			role: 'cancel'
		}
	];

	constructor(
		private fb: FormBuilder,
		private route: ActivatedRoute,
		private router: Router,
		private journalService: JournalService,
		private logging: LoggingService,
		private errorHandling: ErrorHandlingService,
		private toastService: ToastService
	) {
		this.initializeForm();
	}

	ngOnInit() {
		this.route.paramMap.pipe(
			takeUntil(this.destroy$)
		).subscribe(params => {
			this.entryId = params.get('id');
			this.determineMode();
			this.loadPageData();
		});

		this.route.queryParamMap.pipe(
			takeUntil(this.destroy$)
		).subscribe(params => {
			const promptId = params.get('promptId');
			if (promptId) {
				this.loadPrompt(promptId);
			}

			const editMode = params.get('edit');
			if (editMode === 'true' && this.mode === 'view') {
				this.isEditing = true;
			}
		});
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private initializeForm() {
		const today = new Date().toISOString();

		this.entryForm = this.fb.group({
			title: ['', Validators.required],
			content: ['', [Validators.required, this.richTextValidator.bind(this)]],
			date: [today, Validators.required],
			category: [JournalCategory.REFLECTION],
			customCategory: [''],
			mood: [null],
			energy: [null],
			tags: [[]],
			promptId: [null],
			promptText: [null]
		});
	}

	private determineMode() {
		if (this.entryId === 'new' || !this.entryId) {
			this.mode = 'new';
			this.isEditing = true;
		} else {
			this.mode = 'view';
			this.isEditing = false;
		}

		this.logging.debug('Journal entry page mode determined', {
			mode: this.mode,
			entryId: this.entryId
		});
	}

	private async loadPageData() {
		if (this.mode === 'view') {
			await this.loadEntry();
		}
	}

	private async loadEntry() {
		if (!this.entryId) return;

		this.isLoading = true;

		try {
			this.journalService.getJournalEntry(this.entryId).pipe(
				takeUntil(this.destroy$)
			).subscribe({
				next: (entry) => {
					if (entry) {
						this.currentEntry = entry;
						this.prefillForm(entry);
						this.logging.debug('Journal entry loaded', { entryId: this.entryId });
					} else {
						this.logging.warn('Journal entry not found', { entryId: this.entryId });
						this.router.navigate(['/tabs/journal']);
					}
					this.isLoading = false;
				},
				error: (error) => {
					this.logging.error('Failed to load journal entry', { entryId: this.entryId, error });
					this.isLoading = false;
					this.router.navigate(['/tabs/journal']);
				}
			});
		} catch (error) {
			this.logging.error('Error loading journal entry', { entryId: this.entryId, error });
			this.isLoading = false;
		}
	}

	private async loadPrompt(promptId: string) {
		try {
			// Get prompt by ID (works for both daily prompts and reflection prompts)
			this.journalService.getPromptById(promptId).pipe(
				takeUntil(this.destroy$)
			).subscribe({
				next: (prompt) => {
					if (prompt) {
						this.selectedPrompt = prompt;
						this.prefillFromPrompt();
						this.logging.debug('Prompt loaded and applied', { promptId, promptText: prompt.text });
					} else {
						this.logging.warn('Prompt not found', { promptId });
					}
				},
				error: (error) => {
					this.logging.error('Failed to load prompt', { promptId, error });
				}
			});
		} catch (error) {
			this.logging.error('Error loading prompt', { promptId, error });
		}
	}

	private prefillForm(entry: JournalEntry) {
		// Handle custom categories - check if the category is one of the predefined enum values
		const predefinedCategories = Object.values(JournalCategory);
		let category = entry.category || JournalCategory.REFLECTION;
		let customCategory = '';

		// If the category is not in the predefined list, treat it as custom
		if (entry.category && !predefinedCategories.includes(entry.category as JournalCategory)) {
			category = JournalCategory.CUSTOM;
			customCategory = entry.category;
		}

		this.entryForm.patchValue({
			title: entry.title || '',
			content: entry.content,
			date: entry.date,
			category: category,
			customCategory: customCategory,
			mood: entry.mood,
			energy: entry.energy,
			promptId: entry.promptId,
			promptText: entry.promptText
		});

		// Update validation if custom category is selected
		if (category === JournalCategory.CUSTOM) {
			this.entryForm.get('customCategory')?.setValidators([Validators.required, Validators.minLength(2)]);
			this.entryForm.get('customCategory')?.updateValueAndValidity();
		}

		this.selectedTags = entry.tags || [];

		// Load prompt if entry was created from a prompt
		if (entry.promptId) {
			this.loadPrompt(entry.promptId);
		}
	}

	private prefillFromPrompt() {
		if (!this.selectedPrompt) return;

		this.entryForm.patchValue({
			promptId: this.selectedPrompt.id,
			promptText: this.selectedPrompt.text,
			category: this.selectedPrompt.category,
			title: this.getCategoryDisplayName(this.selectedPrompt.category)
		});
	}

	// UI Helper Methods
	getCategoryDisplayName(category: JournalCategory): string {
		if (category === JournalCategory.CUSTOM) {
			return 'Custom';
		}
		return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
	}

	getCategoryIcon(category: JournalCategory): string {
		switch (category) {
			case JournalCategory.GRATITUDE: return 'fa-heart';
			case JournalCategory.REFLECTION: return 'fa-star';
			case JournalCategory.GROWTH: return 'fa-trending-up';
			case JournalCategory.MINDFULNESS: return 'fa-leaf';
			case JournalCategory.GOALS: return 'fa-target';
			case JournalCategory.RELATIONSHIPS: return 'fa-people-group';
			case JournalCategory.HEALTH: return 'fa-dumbbell';
			case JournalCategory.CHALLENGES: return 'fa-shield';
			case JournalCategory.WORK: return 'fa-briefcase';
			case JournalCategory.DREAMS: return 'fa-moon';
			case JournalCategory.CUSTOM: return 'fa-pen';
			default: return 'fa-pen';
		}
	}

	getMoodEmoji(mood: number | null): string {
		if (!mood) return '😊';
		const moodOption = this.moodOptions.find(option => option.value === mood);
		return moodOption ? moodOption.emoji : '😊';
	}

	getEnergyLabel(energy: number | null): string {
		if (!energy) return 'Medium';
		const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
		return labels[energy - 1] || 'Medium';
	}

	getSelectedMoodLabel(): string {
		const moodValue = this.entryForm.get('mood')?.value;
		if (!moodValue) return '';

		const moodOption = this.moodOptions.find(m => m.value === moodValue);
		return moodOption ? moodOption.label : '';
	}

	getSelectedMoodValue(): number | null {
		return this.entryForm.get('mood')?.value || null;
	}

	getSelectedEnergyValue(): number | null {
		return this.entryForm.get('energy')?.value || null;
	}

	isMoodSelected(moodValue: number): boolean {
		return this.entryForm.get('mood')?.value === moodValue;
	}

	selectMood(value: number): void {
		this.entryForm.patchValue({ mood: value });
		this.logging.debug('Mood selected', { value });
	}

	trackByMoodValue(index: number, mood: any): number {
		return mood.value;
	}

	trackByTagName(index: number, tag: string): string {
		return tag;
	}

	// Validation error handling
	private getValidationErrors(): string[] {
		const errors: string[] = [];

		if (this.entryForm.get('title')?.hasError('required')) {
			errors.push('Title is required');
		}

		if (this.entryForm.get('content')?.hasError('required')) {
			errors.push('Content is required');
		}

		if (this.entryForm.get('content')?.hasError('minLength')) {
			errors.push('Content must be at least 10 characters');
		}

		if (this.entryForm.get('date')?.hasError('required')) {
			errors.push('Date is required');
		}

		if (this.entryForm.get('customCategory')?.hasError('required')) {
			errors.push('Custom category name is required');
		}

		if (this.entryForm.get('customCategory')?.hasError('minLength')) {
			errors.push('Custom category must be at least 2 characters');
		}

		return errors;
	}

	private showValidationToast(errors: string[]): void {
		const message = errors.length === 1
			? errors[0]
			: `Please fix the following:\n• ${errors.join('\n• ')}`;

		this.toastService.showError(message);
	}

	private showSuccessToast(message: string): void {
		this.toastService.showSuccess(message);
	}

	private showErrorToast(message: string): void {
		this.toastService.showError(message);
	}

	isCustomCategorySelected(): boolean {
		return this.entryForm.get('category')?.value === JournalCategory.CUSTOM;
	}

	// Handle save button click with validation feedback
	async handleSaveClick() {
		if (this.isSaving) {
			return; // Prevent multiple clicks while saving
		}

		// Always mark fields as touched to show validation errors
		this.entryForm.markAllAsTouched();

		if (this.entryForm.invalid) {
			// Show validation feedback when form is invalid
			const validationErrors = this.getValidationErrors();
			this.showValidationToast(validationErrors);

			this.logging.debug('Save attempted with invalid form', {
				errors: this.entryForm.errors,
				validationErrors
			});
			return;
		}

		// Form is valid, proceed with save
		await this.onSave();
	}

	onCategoryChange(event: any): void {
		const selectedCategory = event.detail.value;
		this.logging.debug('Category changed', { selectedCategory });

		// If custom category is selected, add validation to customCategory field
		if (selectedCategory === JournalCategory.CUSTOM) {
			this.entryForm.get('customCategory')?.setValidators([Validators.required, Validators.minLength(2)]);
		} else {
			// Remove validation and clear custom category value
			this.entryForm.get('customCategory')?.clearValidators();
			this.entryForm.patchValue({ customCategory: '' });
		}
		this.entryForm.get('customCategory')?.updateValueAndValidity();
	}

	getContentLength(): number {
		const htmlContent = this.entryForm.get('content')?.value || '';
		const textContent = this.stripHtml(htmlContent);
		return textContent.length;
	}

	getWordCount(): number {
		const htmlContent = this.entryForm.get('content')?.value || '';
		const textContent = this.stripHtml(htmlContent);
		return textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
	}

	getReadingTime(): number {
		const content = this.entryForm.get('content')?.value || '';
		const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
		return Math.max(1, Math.ceil(words / 200));
	}

	getTodayISOString(): string {
		const today = new Date();
		return today.toISOString().split('T')[0];
	}

	private stripHtml(html: string): string {
		const temp = document.createElement('div');
		temp.innerHTML = html;
		return temp.textContent || temp.innerText || '';
	}

	private richTextValidator(control: AbstractControl): ValidationErrors | null {
		const htmlContent = control.value || '';
		const temp = document.createElement('div');
		temp.innerHTML = htmlContent;
		const textContent = temp.textContent || temp.innerText || '';

		if (textContent.trim().length < 10) {
			return { minLength: { requiredLength: 10, actualLength: textContent.trim().length } };
		}

		return null;
	}

	// Tag Management
	toggleTag(tag: string) {
		const index = this.selectedTags.indexOf(tag);
		if (index > -1) {
			this.selectedTags.splice(index, 1);
		} else {
			this.selectedTags.push(tag);
		}
		this.entryForm.patchValue({ tags: this.selectedTags });
	}

	isTagSelected(tag: string): boolean {
		return this.selectedTags.includes(tag);
	}

	// Action Methods
	toggleEdit() {
		this.isEditing = !this.isEditing;
		this.logging.debug('Edit mode toggled', { isEditing: this.isEditing });
	}

	async onSave() {
		// This method is now only called when form is valid
		this.logging.debug('Saving journal entry', {
			formValue: this.entryForm.value
		});

		this.isSaving = true;

		try {
			const formValue = this.entryForm.value;

			// Handle custom category
			let finalCategory = formValue.category;
			if (formValue.category === JournalCategory.CUSTOM && formValue.customCategory) {
				finalCategory = formValue.customCategory.toLowerCase().trim();
			}

			const entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> = {
				userId: '', // Will be set by the service
				content: formValue.content,
				date: formValue.date,
				category: finalCategory,
				...(formValue.title && { title: formValue.title }),
				...(formValue.mood && { mood: formValue.mood }),
				...(formValue.energy && { energy: formValue.energy }),
				...(this.selectedTags.length > 0 && { tags: this.selectedTags }),
				...(formValue.promptId && { promptId: formValue.promptId }),
				...(formValue.promptText && { promptText: formValue.promptText })
			};

			if (this.mode === 'new') {
				const entryId = await this.journalService.createJournalEntry(entryData);
				this.logging.info('Journal entry created', { entryId });
				this.showSuccessToast('Journal entry created successfully!');
				this.router.navigate(['/journal-entry', entryId]);
			} else if (this.currentEntry) {
				await this.journalService.updateJournalEntry(this.currentEntry.id, entryData);
				this.logging.info('Journal entry updated', { entryId: this.currentEntry.id });
				this.showSuccessToast('Journal entry updated successfully!');
				this.isEditing = false;
				await this.loadEntry(); // Refresh data
			}

		} catch (error) {
			this.logging.error('Failed to save journal entry', { error });
			this.showErrorToast('Failed to save journal entry. Please try again.');
			this.errorHandling.handleErrorGracefully('saveJournalEntry', error);
		} finally {
			this.isSaving = false;
		}
	}

	async saveDraft() {
		// TODO: Implement draft saving
		this.logging.debug('Save draft requested');
	}

	async confirmDelete() {
		if (!this.currentEntry) return;

		const confirmed = confirm(`Are you sure you want to delete "${this.currentEntry.title || 'this entry'}"?`);
		if (!confirmed) return;

		try {
			await this.journalService.deleteJournalEntry(this.currentEntry.id);
			this.logging.info('Journal entry deleted', { entryId: this.currentEntry.id });
			this.router.navigate(['/tabs/journal']);
		} catch (error) {
			this.logging.error('Failed to delete journal entry', { error });
		}
	}

	onBack() {
		this.router.navigate(['/tabs/journal']);
	}

	onMoreOptions() {
		this.showActionSheet = true;
	}
} 