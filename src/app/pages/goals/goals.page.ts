import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
		RouterLink,
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
	showGoalForm = false;
	goalTitle = '';
	goalCategory: Goal['category'] = 'mind';
	savingGoal = false;

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
		this.goalTitle = '';
		this.showGoalForm = true;
	}

	async saveGoal(): Promise<void> {
		const title = this.goalTitle.trim();
		if (!title || this.savingGoal) return;
		this.savingGoal = true;
		try {
			await this.goalService.createGoal({ title, category: this.goalCategory });
			this.showGoalForm = false;
			this.goalTitle = '';
			this.toastService.showSuccess('Goal created!');
		} catch {
			this.toastService.showError('Could not create your goal. Please try again.');
		} finally {
			this.savingGoal = false;
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
