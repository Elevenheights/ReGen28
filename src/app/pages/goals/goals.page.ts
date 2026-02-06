import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	IonContent,
	IonHeader,
	IonTitle,
	IonToolbar,
	IonButton,
	IonButtons,
	IonIcon,
	IonList,
	IonItem,
	IonLabel,
	IonBadge,
	IonProgressBar,
	IonCheckbox,
	IonSpinner,
	ModalController
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';
import { GoalService } from '../../services/goal.service';
import { Goal } from '../../models/goal.interface';
import { LoggingService } from '../../services/logging.service';
import { ToastService } from '../../services/toast.service';

@Component({
	selector: 'app-goals',
	templateUrl: './goals.page.html',
	styleUrls: ['./goals.page.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		IonContent,
		IonHeader,
		IonTitle,
		IonToolbar,
		IonButton,
		IonButtons,
		IonIcon,
		IonList,
		IonItem,
		IonLabel,
		IonBadge,
		IonProgressBar,
		IonCheckbox,
		IonSpinner
	]
})
export class GoalsPage implements OnInit, OnDestroy {
	private destroy$ = new Subject<void>();

	goals: Goal[] = [];
	isLoading = true;

	get activeGoals(): Goal[] {
		return this.goals.filter(g => g.status === 'active');
	}

	get completedGoals(): Goal[] {
		return this.goals.filter(g => g.status === 'completed');
	}

	constructor(
		private goalService: GoalService,
		private logging: LoggingService,
		private toastService: ToastService,
		private modalCtrl: ModalController
	) { }

	ngOnInit() {
		this.loadGoals();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	loadGoals() {
		this.isLoading = true;
		this.goalService.getGoals().pipe(
			takeUntil(this.destroy$)
		).subscribe({
			next: (goals) => {
				this.goals = goals;
				this.isLoading = false;
				this.logging.debug('Goals loaded', { count: goals.length });
			},
			error: (error) => {
				this.logging.error('Failed to load goals', error);
				this.isLoading = false;
				this.toastService.showError('Could not load goals');
			}
		});
	}

	async onAddGoal() {
		this.logging.info('User clicked Add Goal');
		// For now, prompt for a title. Later we'll use a modal.
		const title = prompt('Enter goal title:');
		if (title) {
			try {
				await this.goalService.createGoal({ title, category: 'mind' });
				this.toastService.showSuccess('Goal created!');
			} catch (error) {
				this.toastService.showError('Failed to create goal');
			}
		}
	}

	async onToggleMilestone(goalId: string, milestoneId: string) {
		try {
			await this.goalService.toggleMilestone(goalId, milestoneId);
		} catch (error) {
			this.toastService.showError('Failed to update milestone');
		}
	}

	getPriorityColor(priority: string): string {
		switch (priority) {
			case 'high': return 'danger';
			case 'medium': return 'warning';
			case 'low': return 'success';
			default: return 'medium';
		}
	}

	getCategoryIcon(category: string): string {
		switch (category) {
			case 'mind': return 'brain-outline';
			case 'body': return 'fitness-outline';
			case 'soul': return 'heart-outline';
			case 'beauty': return 'sparkles-outline';
			default: return 'flag-outline';
		}
	}
}
