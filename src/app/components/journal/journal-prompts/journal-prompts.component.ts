import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { JournalPrompt } from '../../../models/journal.interface';

@Component({
	selector: 'app-journal-prompts',
	templateUrl: './journal-prompts.component.html',
	styleUrls: ['./journal-prompts.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class JournalPromptsComponent {
	@Input() prompts: JournalPrompt[] = [];
	@Input() dailyPrompt: JournalPrompt | null = null;
	@Input() isLoadingPrompts: boolean = false;
	@Input() isLoadingDailyPrompt: boolean = false;
	@Input() isRefreshing: boolean = false;

	@Output() promptSelected = new EventEmitter<JournalPrompt>();
	@Output() refreshPrompts = new EventEmitter<void>();

	constructor() { }

	onPromptSelected(prompt: JournalPrompt) {
		this.promptSelected.emit(prompt);
	}

	onRefresh() {
		this.refreshPrompts.emit();
	}

	getCategoryIcon(category?: string): string {
		switch (category?.toLowerCase()) {
			case 'gratitude': return 'fa-heart';
			case 'reflection': return 'fa-star';
			case 'growth': return 'fa-trending-up';
			case 'mindfulness': return 'fa-leaf';
			case 'goals': return 'fa-target';
			case 'relationships': return 'fa-people-group';
			case 'health': return 'fa-dumbbell';
			case 'challenges': return 'fa-shield';
			case 'work': return 'fa-briefcase';
			case 'dreams': return 'fa-moon';
			default: return 'fa-pen';
		}
	}
}
