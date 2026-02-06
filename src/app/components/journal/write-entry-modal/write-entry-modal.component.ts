import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IonHeader,
	IonToolbar,
	IonTitle,
	IonContent,
	IonButton,
	IonButtons,
	IonIcon,
	IonItem,
	IonLabel,
	IonInput,
	IonTextarea,
	IonSelect,
	IonSelectOption,
	IonRange,
	IonSpinner,
	ModalController
} from '@ionic/angular/standalone';

// Services
import { JournalService } from '../../../services/journal.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';

// Models
import { JournalCategory, JournalPrompt } from '../../../models/journal.interface';

@Component({
	selector: 'app-write-entry-modal',
	templateUrl: './write-entry-modal.component.html',
	styleUrls: ['./write-entry-modal.component.scss'],
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
		IonLabel,
		IonInput,
		IonTextarea,
		IonSelect,
		IonSelectOption,
		IonRange,
		IonSpinner
	]
})
export class WriteEntryModalComponent implements OnInit {
	@Input() prompt?: JournalPrompt;

	entryForm: FormGroup;
	isSaving = false;

	categories = Object.values(JournalCategory);

	moodOptions = [
		{ value: 1, emoji: '😢', label: 'Very Sad' },
		{ value: 2, emoji: '😔', label: 'Sad' },
		{ value: 4, emoji: '😐', label: 'Neutral' },
		{ value: 7, emoji: '😊', label: 'Good' },
		{ value: 10, emoji: '🤩', label: 'Amazing' }
	];

	constructor(
		private fb: FormBuilder,
		private modalCtrl: ModalController,
		private journalService: JournalService,
		private logging: LoggingService,
		private toastService: ToastService
	) {
		this.entryForm = this.fb.group({
			title: ['', Validators.required],
			content: ['', [Validators.required, Validators.minLength(5)]],
			category: [JournalCategory.REFLECTION, Validators.required],
			mood: [7], // Default to 7 (😊)
			energy: [3], // Default to 3 (Medium)
			tags: [[]]
		});
	}

	ngOnInit() {
		if (this.prompt) {
			this.entryForm.patchValue({
				title: this.getPromptTitle(this.prompt),
				category: this.prompt.category || JournalCategory.REFLECTION,
				content: ''
			});
		} else {
			// Default title for empty entries
			const today = new Date().toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
			this.entryForm.patchValue({
				title: `Reflection - ${today}`
			});
		}
	}

	private getPromptTitle(prompt: JournalPrompt): string {
		const category = prompt.category || 'Journal';
		return `${category.charAt(0).toUpperCase() + category.slice(1)} Reflection`;
	}

	getCategoryIcon(category: string): string {
		switch (category?.toLowerCase()) {
			case 'gratitude': return 'fa-heart';
			case 'reflection': return 'fa-star';
			case 'growth': return 'fa-trending-up';
			case 'mindfulness': return 'fa-leaf';
			case 'goals': return 'fa-target';
			case 'health': return 'fa-dumbbell';
			default: return 'fa-pen';
		}
	}

	getMoodEmoji(mood: number): string {
		const option = this.moodOptions.find(o => o.value <= mood) || this.moodOptions[0];
		// Find closest or just specific ones
		if (mood <= 2) return '😢';
		if (mood <= 4) return '😐';
		if (mood <= 7) return '😊';
		return '🤩';
	}

	dismiss() {
		this.modalCtrl.dismiss();
	}

	async save() {
		if (this.entryForm.invalid) return;

		this.isSaving = true;
		try {
			const formValue = this.entryForm.value;
			const entryData = {
				...formValue,
				date: new Date().toISOString(),
				promptId: this.prompt?.id,
				promptText: this.prompt?.text
			};

			const entryId = await this.journalService.createJournalEntry(entryData);
			this.logging.info('Quick journal entry created', { entryId });
			this.toastService.showSuccess('Entry saved successfully!');
			this.modalCtrl.dismiss({ saved: true, entryId });
		} catch (error) {
			this.logging.error('Failed to save quick entry', error);
			this.toastService.showError('Could not save entry. Please try again.');
		} finally {
			this.isSaving = false;
		}
	}

	selectMood(value: number) {
		this.entryForm.patchValue({ mood: value });
	}
}
