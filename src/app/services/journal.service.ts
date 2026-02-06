import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { JournalEntry, JournalPrompt, JournalStats, JournalCategory } from '../models/journal.interface';
import { Observable, map, switchMap, of, combineLatest, catchError, shareReplay, firstValueFrom } from 'rxjs';
import { ActivityService } from './activity.service';

// AI-powered journal prompt interfaces
interface AIJournalPrompt {
	text: string;
	category: string;
	icon: string;
	description: string;
}

interface DailyJournalPromptResponse {
	userId: string;
	dateKey: string;
	prompt: AIJournalPrompt;
	inspiration: {
		text: string;
		tone: string;
	};
	generatedAt: any;
	source: string;
	model: string;
}

interface ReflectionPromptsResponse {
	userId: string;
	dateKey: string;
	prompts: AIJournalPrompt[];
	theme: {
		title: string;
		description: string;
	};
	generatedAt: any;
	source: string;
	model: string;
}

@Injectable({
	providedIn: 'root'
})
export class JournalService {
	private readonly COLLECTION_NAME = 'journal-entries';

	// Cache for AI prompts (similar to tracker suggestions)
	private dailyPromptCache: { [dateKey: string]: DailyJournalPromptResponse } = {};
	private reflectionPromptsCache: { [dateKey: string]: ReflectionPromptsResponse } = {};
	private promptsCacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

	constructor(
		private databaseService: DatabaseService,
		private authService: AuthService,
		private userService: UserService,
		private activityService: ActivityService,
		private errorHandlingService: ErrorHandlingService,
		private loggingService: LoggingService
	) {
		// Clear cache when user logs out
		this.authService.user$.subscribe(user => {
			if (!user) {
				this.clearPromptCaches();
			}
		});
	}

	// Create a new journal entry
	async createJournalEntry(entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
		try {
			this.loggingService.debug('Creating new journal entry', { title: entryData.title });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const entry: Omit<JournalEntry, 'id'> = {
				...entryData,
				userId: authUser.uid,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const entryId = await firstValueFrom(this.databaseService.createDocument(this.COLLECTION_NAME, entry));

			if (!entryId) {
				throw new Error('Failed to create journal entry');
			}

			// Update user stats
			await this.userService.incrementStat('totalJournalEntries');

			// Create recent activity record
			try {
				await this.activityService.createActivityFromJournalEntry({ ...entry, id: entryId });
			} catch (activityError) {
				this.loggingService.warn('Journal entry created but activity record failed', { activityError });
			}

			this.loggingService.info('Journal entry created successfully', { entryId });
			return entryId;
		} catch (error) {
			this.loggingService.error('Failed to create journal entry', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to create journal entry');
		}
	}

	// Get all journal entries for current user
	getUserJournalEntries(limit: number = 50): Observable<JournalEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getUserDocuments<JournalEntry>(
					this.COLLECTION_NAME,
					authUser.uid,
					{
						orderBy: [{ field: 'date', direction: 'desc' }],
						limit
					}
				);
			}),
			catchError(error => {
				this.loggingService.error('Failed to fetch user journal entries', error);
				return of([]);
			})
		);
	}

	// Get a specific journal entry
	getJournalEntry(entryId: string): Observable<JournalEntry | null> {
		return this.databaseService.getDocument<JournalEntry>(this.COLLECTION_NAME, entryId).pipe(
			catchError(error => {
				this.loggingService.error('Failed to fetch journal entry', error);
				return of(null);
			})
		);
	}

	// Update a journal entry
	async updateJournalEntry(entryId: string, updates: Partial<JournalEntry>): Promise<void> {
		try {
			this.loggingService.debug('Updating journal entry', { entryId });

			const updateData = {
				...updates,
				updatedAt: new Date()
			};

			await firstValueFrom(this.databaseService.updateDocument(this.COLLECTION_NAME, entryId, updateData));

			this.loggingService.info('Journal entry updated successfully', { entryId });
		} catch (error) {
			this.loggingService.error('Failed to update journal entry', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to update journal entry');
		}
	}

	// Delete a journal entry
	async deleteJournalEntry(entryId: string): Promise<void> {
		try {
			this.loggingService.debug('Deleting journal entry', { entryId });

			await firstValueFrom(this.databaseService.deleteDocument(this.COLLECTION_NAME, entryId));

			this.loggingService.info('Journal entry deleted successfully', { entryId });
		} catch (error) {
			this.loggingService.error('Failed to delete journal entry', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to delete journal entry');
		}
	}

	// Search journal entries
	searchJournalEntries(searchTerm: string): Observable<JournalEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getUserDocuments<JournalEntry>(
					this.COLLECTION_NAME,
					authUser.uid,
					{
						orderBy: [{ field: 'date', direction: 'desc' }]
					}
				);
			}),
			map(entries => entries.filter(entry =>
				(entry.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(entry.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
			)),
			catchError(error => {
				this.loggingService.error('Failed to search journal entries', error);
				return of([]);
			})
		);
	}

	// Get journal entries by date range
	getJournalEntriesByDateRange(startDate: Date, endDate: Date): Observable<JournalEntry[]> {
		return this.authService.user$.pipe(
			switchMap(authUser => {
				if (!authUser) return of([]);

				return this.databaseService.getDocumentsByDateRange<JournalEntry>(
					this.COLLECTION_NAME,
					startDate,
					endDate,
					'date',
					{
						where: [{ field: 'userId', operator: '==', value: authUser.uid }]
					}
				);
			}),
			catchError(error => {
				this.loggingService.error('Failed to fetch journal entries by date range', error);
				return of([]);
			})
		);
	}

	// Get recent journal entries
	getRecentJournalEntries(limit: number = 5): Observable<JournalEntry[]> {
		return this.getUserJournalEntries(limit);
	}

	// Calculate journal statistics
	async calculateJournalStats(): Promise<JournalStats> {
		try {
			this.loggingService.debug('Calculating journal statistics');

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const allEntries = await firstValueFrom(this.databaseService.getUserDocuments<JournalEntry>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					orderBy: [{ field: 'date', direction: 'desc' }]
				}
			));

			if (!allEntries || allEntries.length === 0) {
				return {
					userId: authUser.uid,
					totalEntries: 0,
					weeklyCount: 0,
					monthlyCount: 0,
					currentStreak: 0,
					longestStreak: 0,
					averageMood: 0,
					moodTrend: 0,
					totalWords: 0,
					averageWordsPerEntry: 0,
					mostUsedTags: [],
					favoriteCategories: [],
					sentimentTrend: 0,
					emotionalRange: 0,
					lastUpdated: new Date()
				};
			}

			const now = new Date();
			const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			const weeklyEntries = allEntries.filter(entry => new Date(entry.date) >= oneWeekAgo);
			const monthlyEntries = allEntries.filter(entry => new Date(entry.date) >= oneMonthAgo);

			const totalMood = allEntries.reduce((sum, entry) => sum + (entry.mood || 0), 0);
			const averageMood = allEntries.length > 0 ? totalMood / allEntries.length : 0;

			const currentStreak = this.calculateJournalStreak(allEntries);
			const longestStreak = this.calculateLongestStreak(allEntries);

			// Calculate most used tags and favorite categories
			const tagCounts: { [key: string]: number } = {};
			const categoryCounts: { [key: string]: number } = {};

			allEntries.forEach(entry => {
				// Tag counts
				(entry.tags || []).forEach(tag => {
					tagCounts[tag] = (tagCounts[tag] || 0) + 1;
				});

				// Category counts
				if (entry.category) {
					categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
				}
			});

			const mostUsedTags = Object.entries(tagCounts)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10)
				.map(([tag]) => tag);

			const favoriteCategories = Object.entries(categoryCounts)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 5)
				.map(([category]) => category as JournalCategory);

			const stats: JournalStats = {
				userId: authUser.uid,
				totalEntries: allEntries.length,
				weeklyCount: weeklyEntries.length,
				monthlyCount: monthlyEntries.length,
				currentStreak,
				longestStreak,
				averageMood,
				moodTrend: 0, // TODO: Implement trend calculation
				totalWords: 0, // TODO: Calculate from content
				averageWordsPerEntry: 0, // TODO: Calculate from content
				mostUsedTags,
				favoriteCategories,
				sentimentTrend: 0, // TODO: Implement sentiment analysis
				emotionalRange: 0, // TODO: Calculate emotional range
				lastUpdated: new Date()
			};

			this.loggingService.info('Journal statistics calculated successfully', { totalEntries: stats.totalEntries });
			return stats;
		} catch (error) {
			this.loggingService.error('Failed to calculate journal statistics', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to calculate journal statistics');
		}
	}

	// Calculate current journal streak
	private calculateJournalStreak(entries: JournalEntry[]): number {
		if (entries.length === 0) return 0;

		const sortedEntries = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		let streak = 0;
		let currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);

		for (let i = 0; i < sortedEntries.length; i++) {
			const entryDate = new Date(sortedEntries[i].date);
			entryDate.setHours(0, 0, 0, 0);

			if (i === 0) {
				// First entry - check if it's today or yesterday
				const daysDiff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
				if (daysDiff <= 1) {
					streak = 1;
					currentDate = entryDate;
				} else {
					break;
				}
			} else {
				// Subsequent entries - check if they're consecutive
				const expectedDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
				if (entryDate.getTime() === expectedDate.getTime()) {
					streak++;
					currentDate = entryDate;
				} else {
					break;
				}
			}
		}

		return streak;
	}

	// Calculate longest journal streak
	private calculateLongestStreak(entries: JournalEntry[]): number {
		if (entries.length === 0) return 0;

		const sortedEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
		let longestStreak = 0;
		let currentStreak = 0;
		let previousDate: Date | null = null;

		for (const entry of sortedEntries) {
			const entryDate = new Date(entry.date);
			entryDate.setHours(0, 0, 0, 0);

			if (previousDate === null) {
				currentStreak = 1;
			} else {
				const daysDiff = Math.floor((entryDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
				if (daysDiff === 1) {
					currentStreak++;
				} else {
					longestStreak = Math.max(longestStreak, currentStreak);
					currentStreak = 1;
				}
			}

			previousDate = entryDate;
		}

		return Math.max(longestStreak, currentStreak);
	}

	// Get journal dashboard data
	getJournalDashboardData(): Observable<{
		recentEntries: JournalEntry[];
		stats: JournalStats;
		prompts: JournalPrompt[];
	}> {
		return combineLatest([
			this.getRecentJournalEntries(5),
			this.calculateJournalStats(),
			this.getJournalPrompts()
		]).pipe(
			map(([recentEntries, stats, prompts]) => ({
				recentEntries,
				stats,
				prompts
			})),
			catchError(error => {
				this.loggingService.error('Failed to fetch journal dashboard data', error);
				return of({
					recentEntries: [],
					stats: {
						userId: '',
						totalEntries: 0,
						weeklyCount: 0,
						monthlyCount: 0,
						currentStreak: 0,
						longestStreak: 0,
						averageMood: 0,
						moodTrend: 0,
						totalWords: 0,
						averageWordsPerEntry: 0,
						mostUsedTags: [],
						favoriteCategories: [],
						sentimentTrend: 0,
						emotionalRange: 0,
						lastUpdated: new Date()
					},
					prompts: []
				});
			}),
			shareReplay(1)
		);
	}

	// Get mood analytics
	getMoodAnalytics(days: number = 30): Observable<{
		averageMood: number;
		moodTrend: 'improving' | 'declining' | 'stable';
		moodDistribution: { [key: number]: number };
	}> {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		return this.getJournalEntriesByDateRange(startDate, new Date()).pipe(
			map(entries => {
				if (entries.length === 0) {
					return {
						averageMood: 0,
						moodTrend: 'stable' as const,
						moodDistribution: {}
					};
				}

				const moods = entries.map(entry => entry.mood || 0).filter(mood => mood > 0);
				const averageMood = moods.length > 0 ? moods.reduce((sum, mood) => sum + mood, 0) / moods.length : 0;

				// Calculate trend
				const sortedEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				const firstHalf = sortedEntries.slice(0, Math.floor(sortedEntries.length / 2));
				const secondHalf = sortedEntries.slice(Math.floor(sortedEntries.length / 2));

				const firstHalfAvg = firstHalf.reduce((sum, entry) => sum + (entry.mood || 0), 0) / firstHalf.length;
				const secondHalfAvg = secondHalf.reduce((sum, entry) => sum + (entry.mood || 0), 0) / secondHalf.length;

				let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
				if (secondHalfAvg > firstHalfAvg + 0.5) {
					moodTrend = 'improving';
				} else if (secondHalfAvg < firstHalfAvg - 0.5) {
					moodTrend = 'declining';
				}

				// Calculate distribution
				const moodDistribution: { [key: number]: number } = {};
				moods.forEach(mood => {
					moodDistribution[mood] = (moodDistribution[mood] || 0) + 1;
				});

				return {
					averageMood,
					moodTrend,
					moodDistribution
				};
			}),
			catchError(error => {
				this.loggingService.error('Failed to calculate mood analytics', error);
				return of({
					averageMood: 0,
					moodTrend: 'stable' as const,
					moodDistribution: {}
				});
			})
		);
	}

	// Get journal prompts - now AI-powered with fallback
	getJournalPrompts(): Observable<JournalPrompt[]> {
		return this.getAIReflectionPrompts().pipe(
			map(response => {
				if (response && response.prompts) {
					return response.prompts.map(prompt => this.convertAIPromptToJournalPrompt(prompt));
				}
				// Fallback to default prompts
				return this.getDefaultPrompts();
			}),
			catchError(error => {
				this.loggingService.error('Failed to load AI journal prompts, using fallback', error);
				return of(this.getDefaultPrompts());
			})
		);
	}

	// Get daily prompt - now AI-powered with fallback
	getDailyPrompt(): Observable<JournalPrompt> {
		return this.getAIDailyPrompt().pipe(
			map(response => {
				if (response && response.prompt) {
					return this.convertAIPromptToJournalPrompt(response.prompt, response.prompt.text);
				}
				// Fallback to static daily prompt
				return this.getStaticDailyPrompt();
			}),
			catchError(error => {
				this.loggingService.error('Failed to load AI daily prompt, using fallback', error);
				return of(this.getStaticDailyPrompt());
			})
		);
	}

	// Get AI-powered daily prompt
	getAIDailyPrompt(): Observable<DailyJournalPromptResponse | null> {
		return new Observable(observer => {
			this.loadAIDailyPrompt().then(result => {
				observer.next(result);
				observer.complete();
			}).catch(error => {
				this.loggingService.error('Error loading AI daily prompt', error);
				observer.next(null);
				observer.complete();
			});
		});
	}

	// Get AI-powered reflection prompts
	getAIReflectionPrompts(): Observable<ReflectionPromptsResponse | null> {
		return new Observable(observer => {
			this.loadAIReflectionPrompts().then(result => {
				observer.next(result);
				observer.complete();
			}).catch(error => {
				this.loggingService.error('Error loading AI reflection prompts', error);
				observer.next(null);
				observer.complete();
			});
		});
	}

	// Load AI daily prompt with caching
	private async loadAIDailyPrompt(forceRefresh = false): Promise<DailyJournalPromptResponse | null> {
		const todayKey = new Date().toISOString().split('T')[0];

		// Check cache first
		if (!forceRefresh && this.dailyPromptCache[todayKey]) {
			const cached = this.dailyPromptCache[todayKey];
			const cacheAge = Date.now() - (cached.generatedAt?.toMillis?.() || Date.now());

			if (cacheAge < this.promptsCacheExpiry) {
				this.loggingService.debug('Using cached daily prompt', { todayKey });
				return cached;
			}
		}

		try {
			this.loggingService.debug('Loading daily prompt from AI service', { todayKey, forceRefresh });

			// Call Firebase Function
			const result = await firstValueFrom(
				this.databaseService.callFunction('getDailyJournalPrompt', { forceRefresh })
			) as DailyJournalPromptResponse;

			if (result && result.prompt) {
				// Cache the result
				this.dailyPromptCache[todayKey] = result;
				this.loggingService.debug('Daily prompt loaded and cached', { todayKey });
				return result;
			} else {
				throw new Error('Invalid daily prompt response');
			}

		} catch (error) {
			this.loggingService.error('Failed to load AI daily prompt', error);
			return null;
		}
	}

	// Load AI reflection prompts with caching
	private async loadAIReflectionPrompts(forceRefresh = false): Promise<ReflectionPromptsResponse | null> {
		const todayKey = new Date().toISOString().split('T')[0];

		// Check cache first
		if (!forceRefresh && this.reflectionPromptsCache[todayKey]) {
			const cached = this.reflectionPromptsCache[todayKey];
			const cacheAge = Date.now() - (cached.generatedAt?.toMillis?.() || Date.now());

			if (cacheAge < this.promptsCacheExpiry) {
				this.loggingService.debug('Using cached reflection prompts', { todayKey });
				return cached;
			}
		}

		try {
			this.loggingService.debug('Loading reflection prompts from AI service', { todayKey, forceRefresh });

			// Call Firebase Function
			const result = await firstValueFrom(
				this.databaseService.callFunction('getReflectionPrompts', { forceRefresh })
			) as ReflectionPromptsResponse;

			if (result && result.prompts && Array.isArray(result.prompts)) {
				// Cache the result
				this.reflectionPromptsCache[todayKey] = result;
				this.loggingService.debug('Reflection prompts loaded and cached', {
					todayKey,
					promptCount: result.prompts.length
				});
				return result;
			} else {
				throw new Error('Invalid reflection prompts response');
			}

		} catch (error) {
			this.loggingService.error('Failed to load AI reflection prompts', error);
			return null;
		}
	}

	// Convert AI prompt to JournalPrompt interface
	private convertAIPromptToJournalPrompt(aiPrompt: AIJournalPrompt, customText?: string): JournalPrompt {
		const now = new Date();

		// Map AI categories to our enum
		const categoryMap: { [key: string]: JournalCategory } = {
			'gratitude': JournalCategory.GRATITUDE,
			'reflection': JournalCategory.REFLECTION,
			'growth': JournalCategory.GROWTH,
			'mindfulness': JournalCategory.MINDFULNESS,
			'goals': JournalCategory.GOALS,
			'relationships': JournalCategory.RELATIONSHIPS,
			'health': JournalCategory.HEALTH,
			'challenges': JournalCategory.CHALLENGES,
			'work': JournalCategory.WORK,
			'creativity': JournalCategory.REFLECTION, // Map to reflection as fallback
			'values': JournalCategory.REFLECTION,
			'dreams': JournalCategory.GOALS
		};

		// Extract icon name from FontAwesome class
		const iconName = aiPrompt.icon.replace('fa-', '').replace('fa-solid ', '').replace('fa-regular ', '');

		return {
			id: `ai-${aiPrompt.category}-${Date.now()}`,
			text: customText || aiPrompt.text,
			icon: iconName,
			category: categoryMap[aiPrompt.category] || JournalCategory.REFLECTION,
			createdAt: now,
			isActive: true
		};
	}

	// Fallback to static daily prompt (original logic)
	private getStaticDailyPrompt(): JournalPrompt {
		const prompts = this.getDefaultPrompts();
		const today = new Date();
		const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
		const promptIndex = dayOfYear % prompts.length;

		return prompts[promptIndex];
	}

	// Force refresh AI prompts (for development/testing)
	async refreshAIPrompts(): Promise<void> {
		try {
			this.loggingService.debug('Force refreshing AI prompts');

			const [dailyPrompt, reflectionPrompts] = await Promise.all([
				this.loadAIDailyPrompt(true),
				this.loadAIReflectionPrompts(true)
			]);

			this.loggingService.info('AI prompts refreshed successfully', {
				hasDailyPrompt: !!dailyPrompt,
				hasReflectionPrompts: !!reflectionPrompts,
				reflectionCount: reflectionPrompts?.prompts?.length || 0
			});

		} catch (error) {
			this.loggingService.error('Failed to refresh AI prompts', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to refresh journal prompts');
		}
	}

	// Clear prompt caches
	private clearPromptCaches(): void {
		this.dailyPromptCache = {};
		this.reflectionPromptsCache = {};
		this.loggingService.debug('Journal prompt caches cleared');
	}

	// Get cached daily prompt (for immediate display while loading)
	getCachedDailyPrompt(): JournalPrompt | null {
		const todayKey = new Date().toISOString().split('T')[0];
		const cached = this.dailyPromptCache[todayKey];

		if (cached && cached.prompt) {
			return this.convertAIPromptToJournalPrompt(cached.prompt);
		}

		return null;
	}

	// Get cached reflection prompts (for immediate display while loading)
	getCachedReflectionPrompts(): JournalPrompt[] {
		const todayKey = new Date().toISOString().split('T')[0];
		const cached = this.reflectionPromptsCache[todayKey];

		if (cached && cached.prompts && Array.isArray(cached.prompts)) {
			return cached.prompts.map(prompt => this.convertAIPromptToJournalPrompt(prompt));
		}

		return [];
	}

	// Check if AI prompts are available
	areAIPromptsAvailable(): boolean {
		const todayKey = new Date().toISOString().split('T')[0];
		const hasDailyPrompt = !!this.dailyPromptCache[todayKey];
		const hasReflectionPrompts = !!this.reflectionPromptsCache[todayKey];

		return hasDailyPrompt && hasReflectionPrompts;
	}

	// Get AI prompt loading status
	getAIPromptStatus(): { dailyPrompt: boolean; reflectionPrompts: boolean; todayKey: string } {
		const todayKey = new Date().toISOString().split('T')[0];

		return {
			dailyPrompt: !!this.dailyPromptCache[todayKey],
			reflectionPrompts: !!this.reflectionPromptsCache[todayKey],
			todayKey
		};
	}

	// Get prompts by category
	getPromptsByCategory(category: string): Observable<JournalPrompt[]> {
		return this.getJournalPrompts().pipe(
			map(prompts => prompts.filter(prompt => prompt.category === category))
		);
	}

	// Get prompt by ID
	getPromptById(promptId: string): Observable<JournalPrompt | null> {
		return this.getJournalPrompts().pipe(
			map(prompts => prompts.find(prompt => prompt.id === promptId) || null)
		);
	}

	// Get default prompts  
	private getDefaultPrompts(): JournalPrompt[] {
		const now = new Date();
		return [
			{
				id: 'gratitude-1',
				text: 'What are three things you\'re grateful for today?',
				icon: 'heart',
				category: JournalCategory.GRATITUDE,
				createdAt: now,
				isActive: true
			},
			{
				id: 'reflection-1',
				text: 'What was the highlight of your day?',
				icon: 'star',
				category: JournalCategory.REFLECTION,
				createdAt: now,
				isActive: true
			},
			{
				id: 'growth-1',
				text: 'What did you learn about yourself today?',
				icon: 'trending-up',
				category: JournalCategory.GROWTH,
				createdAt: now,
				isActive: true
			},
			{
				id: 'mindfulness-1',
				text: 'How are you feeling right now, and why?',
				icon: 'leaf',
				category: JournalCategory.MINDFULNESS,
				createdAt: now,
				isActive: true
			},
			{
				id: 'goals-1',
				text: 'What small step did you take toward your goals today?',
				icon: 'target',
				category: JournalCategory.GOALS,
				createdAt: now,
				isActive: true
			},
			{
				id: 'relationships-1',
				text: 'How did you connect with others today?',
				icon: 'people',
				category: JournalCategory.RELATIONSHIPS,
				createdAt: now,
				isActive: true
			},
			{
				id: 'health-1',
				text: 'How did you take care of your physical health today?',
				icon: 'fitness',
				category: JournalCategory.HEALTH,
				createdAt: now,
				isActive: true
			},
			{
				id: 'challenges-1',
				text: 'What challenge did you face today and how did you handle it?',
				icon: 'shield',
				category: JournalCategory.CHALLENGES,
				createdAt: now,
				isActive: true
			},
			{
				id: 'work-1',
				text: 'What are you looking forward to tomorrow?',
				icon: 'sunny',
				category: JournalCategory.WORK,
				createdAt: now,
				isActive: true
			}
		];
	}

	// Export journal entries
	async exportJournalEntries(format: 'json' | 'txt' = 'json'): Promise<string> {
		try {
			this.loggingService.debug('Exporting journal entries', { format });

			const authUser = this.authService.getCurrentUser();
			if (!authUser) {
				throw new Error('No authenticated user');
			}

			const entries = await firstValueFrom(this.databaseService.getUserDocuments<JournalEntry>(
				this.COLLECTION_NAME,
				authUser.uid,
				{
					orderBy: [{ field: 'date', direction: 'desc' }]
				}
			));

			if (!entries || entries.length === 0) {
				throw new Error('No journal entries to export');
			}

			let exportData: string;

			if (format === 'json') {
				exportData = JSON.stringify(entries, null, 2);
			} else {
				exportData = entries.map(entry => {
					const date = new Date(entry.date).toLocaleDateString();
					return `${date} - ${entry.title || 'Untitled'}\n${entry.content}\n\n`;
				}).join('');
			}

			this.loggingService.info('Journal entries exported successfully', {
				format,
				entryCount: entries.length
			});

			return exportData;
		} catch (error) {
			this.loggingService.error('Failed to export journal entries', error);
			throw this.errorHandlingService.createAppError(error, 'Failed to export journal entries');
		}
	}
} 