import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
	selector: 'app-page-header',
	templateUrl: './page-header.component.html',
	styleUrls: ['./page-header.component.scss'],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class PageHeaderComponent {
	@Input() title: string = '';
	@Input() subtitle: string = '';
	@Input() theme: 'purple' | 'indigo' | 'amber' | 'rose' | 'neutral' = 'purple';
	@Input() actionIcon: string = '';
	@Input() showProfile: boolean = false;
	@Input() profileUrl: string = '';
	@Input() userName: string = '';

	@Output() actionClick = new EventEmitter<void>();

	get gradientClass(): string {
		switch (this.theme) {
			case 'purple': return 'from-purple-800 via-purple-700 to-fuchsia-800';
			case 'indigo': return 'from-indigo-950 via-indigo-900 to-violet-950';
			case 'amber': return 'from-amber-600 via-orange-600 to-yellow-600';
			case 'rose': return 'from-rose-800 via-rose-700 to-pink-800';
			case 'neutral': return 'from-neutral-900 via-neutral-800 to-neutral-900';
			default: return 'from-purple-800 via-purple-700 to-fuchsia-800';
		}
	}

	get accentColor(): string {
		switch (this.theme) {
			case 'purple': return 'text-purple-200';
			case 'indigo': return 'text-indigo-200';
			case 'amber': return 'text-amber-100';
			case 'rose': return 'text-rose-100';
			case 'neutral': return 'text-neutral-400';
			default: return 'text-purple-200';
		}
	}

	onActionClick() {
		this.actionClick.emit();
	}
}
