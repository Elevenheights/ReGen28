import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { DatabaseService, QueryOptions } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { Goal, GoalStatus } from '../models/goal.interface';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class GoalService {
	private readonly COLLECTION = 'goals';

	constructor(
		private authService: AuthService,
		private db: DatabaseService,
		private errorHandler: ErrorHandlingService,
		private logging: LoggingService
	) { }

	// Get all goals for the current user
	getGoals(): Observable<Goal[]> {
		return this.authService.user$.pipe(
			switchMap(user => {
				if (!user) return of([]);
				const options: QueryOptions = {
					where: [{ field: 'userId', operator: '==', value: user.uid }],
					orderBy: [{ field: 'createdAt', direction: 'desc' }]
				};
				return this.db.queryDocuments<Goal>(this.COLLECTION, options);
			})
		);
	}

	// Get active goals
	getActiveGoals(): Observable<Goal[]> {
		return this.getGoals().pipe(
			map(goals => goals.filter(g => g.status === 'active'))
		);
	}

	// Create a new goal
	async createGoal(goalData: Partial<Goal>): Promise<string> {
		const user = this.authService.getCurrentUser();
		if (!user) throw new Error('No authenticated user');

		const newGoal: Omit<Goal, 'id'> = {
			userId: user.uid,
			title: goalData.title || 'New Goal',
			description: goalData.description || '',
			category: goalData.category || 'custom',
			status: 'active',
			priority: goalData.priority || 'medium',
			progress: 0,
			startDate: new Date(),
			milestones: goalData.milestones || [],
			linkedTrackerIds: goalData.linkedTrackerIds || [],
			createdAt: new Date(),
			updatedAt: new Date(),
			...goalData
		};

		try {
			this.logging.info('Creating new goal', { title: newGoal.title });
			const goalId = await firstValueFrom(this.db.createDocument<Goal>(this.COLLECTION, newGoal));
			return goalId;
		} catch (error) {
			this.errorHandler.handleError('createGoal', error);
			throw error;
		}
	}

	// Update a goal
	async updateGoal(goalId: string, updates: Partial<Goal>): Promise<void> {
		try {
			this.logging.debug('Updating goal', { goalId, updates });
			await firstValueFrom(this.db.updateDocument(this.COLLECTION, goalId, updates));
		} catch (error) {
			this.errorHandler.handleError('updateGoal', error);
			throw error;
		}
	}

	// Delete a goal
	async deleteGoal(goalId: string): Promise<void> {
		try {
			this.logging.info('Deleting goal', { goalId });
			await firstValueFrom(this.db.deleteDocument(this.COLLECTION, goalId));
		} catch (error) {
			this.errorHandler.handleError('deleteGoal', error);
			throw error;
		}
	}

	// Toggle milestone completion
	async toggleMilestone(goalId: string, milestoneId: string): Promise<void> {
		const goals = await firstValueFrom(this.getGoals().pipe(take(1)));
		const goal = goals.find(g => g.id === goalId);
		if (!goal) return;

		const milestones = goal.milestones.map(m => {
			if (m.id === milestoneId) {
				return {
					...m,
					isCompleted: !m.isCompleted,
					completedAt: !m.isCompleted ? new Date() : undefined
				};
			}
			return m;
		});

		// Calculate progress based on milestones if any exist
		let progress = goal.progress;
		if (milestones.length > 0) {
			const completedCount = milestones.filter(m => m.isCompleted).length;
			progress = Math.round((completedCount / milestones.length) * 100);
		}

		const status: GoalStatus = progress === 100 ? 'completed' : goal.status;

		await this.updateGoal(goalId, {
			milestones,
			progress,
			status,
			completedAt: progress === 100 ? new Date() : undefined
		});
	}
}
