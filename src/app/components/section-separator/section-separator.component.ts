import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-section-separator',
	templateUrl: './section-separator.component.html',
	styleUrls: ['./section-separator.component.scss'],
	standalone: true,
	imports: [CommonModule]
})
export class SectionSeparatorComponent {
	@Input() color: string = 'neutral';

	get dotColorClass(): string {
		switch (this.color) {
			case 'emerald': return 'bg-emerald-400';
			case 'purple': return 'bg-purple-400';
			case 'blue': return 'bg-blue-400';
			case 'rose': return 'bg-rose-400';
			case 'amber': return 'bg-amber-400';
			case 'indigo': return 'bg-indigo-400';
			default: return 'bg-neutral-300';
		}
	}
}
