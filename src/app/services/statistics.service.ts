import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import {
	UserDailyStats,
	TrackerDailyStats,
	JournalDailyStats,
	MoodAnalytics,
	PerformanceMetrics,
	TrendAnalysis,
	MilestoneProgress,
	WritingAnalytics,
	MoodCorrelation,
	WeeklyMoodTrend,
	StatsQuery,
	CategoryBreakdown,
	HourlyActivityPattern
} from '../models/statistics.interface';
import { Observable, map, shareReplay, firstValueFrom, of, catchError } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class StatisticsService {
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	private cache: { [key: string]: { data: any; timestamp: number } } = {};

	constructor(
		private db: DatabaseService,
		private errorHandler: ErrorHandlingService,
		private logging: LoggingService,
		private authService: AuthService
	) { }

	// ===============================
	// USER DAILY STATISTICS
	// ===============================

	/**
	 * Get user daily stats for a specific date or date range
	 */
	getUserDailyStats(options: {
		date?: string;
		startDate?: string;
		endDate?: string;
		days?: number;
	} = {}): Observable<UserDailyStats[]> {
		const cacheKey = `user-daily-stats-${JSON.stringify(options)}`;

		// Check cache first
		const cached = this.getCachedData(cacheKey);
		if (cached) {
			this.logging.debug('Using cached user daily stats', options);
			return of(Array.isArray(cached) ? cached : [cached]).pipe(
				map(stats => stats.filter(Boolean))
			);
		}

		this.logging.debug('Loading user daily stats from Firebase', options);

		return this.db.callFunction<any, UserDailyStats | UserDailyStats[]>('getStatistics', {
			type: 'user-daily',
			...options
		}).pipe(
			map(result => {
				const stats = Array.isArray(result) ? result : (result ? [result] : []);
				this.setCachedData(cacheKey, stats);
				return stats;
			}),
			catchError(error => {
				this.logging.error('Failed to load user daily stats', error);
				return this.errorHandler.handleErrorGracefully('getUserDailyStats', error);
			}),
			shareReplay(1)
		);
	}

	/**
	 * Get user daily stats for today only
	 */
	getTodaysStats(): Observable<UserDailyStats | null> {
		const today = new Date().toISOString().split('T')[0];

		return this.getUserDailyStats({ date: today }).pipe(
			map(stats => stats.length > 0 ? stats[0] : null)
		);
	}

	/**
	 * Get user daily stats for the last N days (default 7)
	 */
	getRecentStats(days: number = 7): Observable<UserDailyStats[]> {
		return this.getUserDailyStats({ days });
	}

	// ===============================
	// TRACKER DAILY STATISTICS
	// ===============================

	/**
	 * Get tracker daily stats for a date range
	 */
	getTrackerDailyStats(trackerId: string, options: {
		startDate?: string;
		endDate?: string;
		days?: number;
	} = {}): Observable<TrackerDailyStats[]> {
		const cacheKey = `tracker-daily-stats-${trackerId}-${JSON.stringify(options)}`;

		// Check cache first
		const cached = this.getCachedData(cacheKey);
		if (cached) {
			this.logging.debug('Using cached tracker daily stats', { trackerId, options });
			return of(cached);
		}

		this.logging.debug('Loading tracker daily stats from Firebase', { trackerId, options });

		return this.db.callFunction<any, TrackerDailyStats[]>('getStatistics', {
			type: 'tracker-daily',
			trackerId,
			...options
		}).pipe(
			map(stats => {
				this.setCachedData(cacheKey, stats);
				return stats;
			}),
			catchError(error => {
				this.logging.error('Failed to load tracker daily stats', error);
				return this.errorHandler.handleErrorGracefully('getTrackerDailyStats', error);
			}),
			shareReplay(1)
		);
	}

	/**
	 * Get tracker trends for the last 30 days
	 */
	getTrackerTrends(trackerId: string): Observable<TrendAnalysis> {
		return this.getTrackerDailyStats(trackerId, { days: 30 }).pipe(
			map(stats => this.calculateTrendAnalysis(stats))
		);
	}

	/**
	 * Get tracker milestone progress
	 */
	getTrackerMilestones(trackerId: string): Observable<MilestoneProgress> {
		return this.getTrackerDailyStats(trackerId, { days: 1 }).pipe(
			map(stats => {
				if (stats.length === 0) {
					return {
						current: 0,
						next: 7,
						progress: 0,
						estimatedDaysToNext: 7,
						milestoneHistory: []
					};
				}

				const latest = stats[0];
				return {
					current: latest.currentStreak,
					next: latest.nextMilestone,
					progress: latest.milestoneProgress,
					estimatedDaysToNext: latest.nextMilestone - latest.currentStreak,
					milestoneHistory: [] // TODO: Implement milestone history
				};
			})
		);
	}

	// ===============================
	// JOURNAL DAILY STATISTICS
	// ===============================

	/**
	 * Get journal daily stats for a date range
	 */
	getJournalDailyStats(options: {
		startDate?: string;
		endDate?: string;
		days?: number;
	} = {}): Observable<JournalDailyStats[]> {
		const cacheKey = `journal-daily-stats-${JSON.stringify(options)}`;

		// Check cache first
		const cached = this.getCachedData(cacheKey);
		if (cached) {
			this.logging.debug('Using cached journal daily stats', options);
			return of(cached);
		}

		this.logging.debug('Loading journal daily stats from Firebase', options);

		return this.db.callFunction<any, JournalDailyStats[]>('getStatistics', {
			type: 'journal-daily',
			...options
		}).pipe(
			map(stats => {
				this.setCachedData(cacheKey, stats);
				return stats;
			}),
			catchError(error => {
				this.logging.error('Failed to load journal daily stats', error);
				return this.errorHandler.handleErrorGracefully('getJournalDailyStats', error);
			}),
			shareReplay(1)
		);
	}

	/**
	 * Get writing patterns and analytics
	 */
	getWritingPatterns(): Observable<WritingAnalytics> {
		return this.getJournalDailyStats({ days: 30 }).pipe(
			map(stats => this.calculateWritingAnalytics(stats))
		);
	}

	// ===============================
	// MOOD & ANALYTICS
	// ===============================

	/**
	 * Get overall mood analytics from all sources
	 */
	getOverallMoodAnalytics(): Observable<MoodAnalytics> {
		return this.getUserDailyStats({ days: 30 }).pipe(
			map(stats => this.calculateMoodAnalytics(stats))
		);
	}

	/**
	 * Get weekly mood trend
	 */
	getWeeklyMoodTrend(weeksBack: number = 4): Observable<WeeklyMoodTrend[]> {
		const cacheKey = `weekly-mood-trend-${weeksBack}`;

		// Check cache first
		const cached = this.getCachedData(cacheKey);
		if (cached) {
			this.logging.debug('Using cached weekly mood trend', { weeksBack });
			return of(cached);
		}

		this.logging.debug('Loading weekly mood trend from Firebase', { weeksBack });

		return this.db.callFunction<any, WeeklyMoodTrend[]>('getStatistics', {
			type: 'weekly-mood',
			weeksBack
		}).pipe(
			map(trend => {
				this.setCachedData(cacheKey, trend);
				return trend;
			}),
			catchError(error => {
				this.logging.error('Failed to load weekly mood trend', error);
				return this.errorHandler.handleErrorGracefully('getWeeklyMoodTrend', error);
			}),
			shareReplay(1)
		);
	}

	/**
	 * Get mood correlation analysis
	 */
	getMoodJournalCorrelation(): Observable<MoodCorrelation> {
		return this.getUserDailyStats({ days: 30 }).pipe(
			map(stats => this.calculateMoodCorrelation(stats))
		);
	}

	// ===============================
	// PERFORMANCE INSIGHTS
	// ===============================

	/**
	 * Get performance insights and metrics
	 */
	getPerformanceInsights(days: number = 30): Observable<PerformanceMetrics> {
		const cacheKey = `performance-insights-${days}`;

		// Check cache first
		const cached = this.getCachedData(cacheKey);
		if (cached) {
			this.logging.debug('Using cached performance insights', { days });
			return of(cached);
		}

		this.logging.debug('Loading performance insights from Firebase', { days });

		return this.db.callFunction<any, PerformanceMetrics>('getStatistics', {
			type: 'performance',
			days
		}).pipe(
			map(insights => {
				this.setCachedData(cacheKey, insights);
				return insights;
			}),
			catchError(error => {
				this.logging.error('Failed to load performance insights', error);
				return this.errorHandler.handleErrorGracefully('getPerformanceInsights', error);
			}),
			shareReplay(1)
		);
	}

	// ===============================
	// MANUAL OPERATIONS
	// ===============================

	/**
	 * Manually trigger statistics calculation
	 */
	async triggerStatsCalculation(date?: string): Promise<void> {
		try {
			this.logging.info('Triggering manual stats calculation', { date });

			await firstValueFrom(this.db.callFunction('triggerStatsCalculation', { date }));

			// Clear cache after recalculation
			this.clearCache();

			this.logging.info('Manual stats calculation completed');
		} catch (error) {
			this.logging.error('Failed to trigger stats calculation', error);
			throw this.errorHandler.createAppError(error, 'Failed to trigger statistics calculation');
		}
	}

	/**
	 * Backfill historical statistics
	 */
	async backfillStats(daysBack: number = 30): Promise<void> {
		try {
			this.logging.info('Starting stats backfill', { daysBack });

			await firstValueFrom(this.db.callFunction('backfillUserStats', { daysBack }));

			// Clear cache after backfill
			this.clearCache();

			this.logging.info('Stats backfill completed');
		} catch (error) {
			this.logging.error('Failed to backfill stats', error);
			throw this.errorHandler.createAppError(error, 'Failed to backfill statistics');
		}
	}

	// ===============================
	// HELPER CALCULATIONS
	// ===============================

	private calculateMoodAnalytics(stats: UserDailyStats[]): MoodAnalytics {
		if (stats.length === 0) {
			return {
				averageMood: 0,
				trend: 'stable',
				weeklyData: [],
				sourceBreakdown: { journal: 0, trackers: 0, moodEntries: 0 },
				correlationWithActivity: 0
			};
		}

		const moodValues = stats.map(s => s.overallAverageMood).filter(m => m > 0);
		const averageMood = moodValues.length > 0 ?
			moodValues.reduce((sum, mood) => sum + mood, 0) / moodValues.length : 0;

		const trend = this.calculateMoodTrend(stats);
		const sourceBreakdown = this.calculateSourceBreakdown(stats);

		return {
			averageMood: Math.round(averageMood * 10) / 10,
			trend,
			weeklyData: this.aggregateByWeek(stats, 'overallAverageMood'),
			sourceBreakdown,
			correlationWithActivity: this.calculateActivityCorrelation(stats)
		};
	}

	private calculateWritingAnalytics(stats: JournalDailyStats[]): WritingAnalytics {
		if (stats.length === 0) {
			return {
				averageWordsPerEntry: 0,
				writingStreak: 0,
				preferredWritingTime: '09:00',
				topCategories: [],
				sentimentTrend: 'stable'
			};
		}

		const totalWords = stats.reduce((sum, s) => sum + s.totalWords, 0);
		const totalEntries = stats.reduce((sum, s) => sum + s.entriesCount, 0);
		const averageWordsPerEntry = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;

		const writingStreak = stats.length > 0 ? Math.max(...stats.map(s => s.currentStreak)) : 0;

		const allCategories = stats.flatMap((s: JournalDailyStats) => s.categoriesUsed);
		const categoryCount: { [key: string]: number } = {};
		allCategories.forEach((cat: string) => {
			categoryCount[cat] = (categoryCount[cat] || 0) + 1;
		});

		const topCategories = Object.keys(categoryCount)
			.sort((a, b) => categoryCount[b] - categoryCount[a])
			.slice(0, 5);

		return {
			averageWordsPerEntry,
			writingStreak,
			preferredWritingTime: '09:00', // TODO: Calculate from actual data
			topCategories,
			sentimentTrend: 'stable' // TODO: Calculate from sentiment scores
		};
	}

	private calculateTrendAnalysis(stats: TrackerDailyStats[]): TrendAnalysis {
		if (stats.length < 2) {
			return { direction: 'stable', confidence: 0, changePercentage: 0, timeframe: 'weekly' };
		}

		// Calculate trend based on adherence over time
		const adherenceValues = stats.map(s => s.adherence);
		const firstHalf = adherenceValues.slice(0, Math.floor(adherenceValues.length / 2));
		const secondHalf = adherenceValues.slice(Math.floor(adherenceValues.length / 2));

		const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
		const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

		const changePercentage = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
		const direction = Math.abs(changePercentage) < 5 ? 'stable' :
			(changePercentage > 0 ? 'improving' : 'declining');

		return {
			direction,
			confidence: Math.min(Math.abs(changePercentage) / 10, 1),
			changePercentage: Math.round(changePercentage * 10) / 10,
			timeframe: 'weekly'
		};
	}

	private calculateMoodCorrelation(stats: UserDailyStats[]): MoodCorrelation {
		return {
			trackerCorrelations: {}, // TODO: Implement per-tracker correlation
			categoryCorrelations: {
				mind: this.calculateCorrelation(stats, 'overallAverageMood', 'mindMinutes'),
				body: this.calculateCorrelation(stats, 'overallAverageMood', 'bodyActivities'),
				soul: this.calculateCorrelation(stats, 'overallAverageMood', 'soulActivities'),
				beauty: this.calculateCorrelation(stats, 'overallAverageMood', 'beautyRoutines')
			},
			timeOfDayCorrelation: [] // TODO: Implement hourly correlation
		};
	}

	private calculateMoodTrend(stats: UserDailyStats[]): 'improving' | 'declining' | 'stable' {
		if (stats.length < 2) return 'stable';

		const moodValues = stats.map(s => s.overallAverageMood).filter(m => m > 0);
		if (moodValues.length < 2) return 'stable';

		const firstHalf = moodValues.slice(0, Math.floor(moodValues.length / 2));
		const secondHalf = moodValues.slice(Math.floor(moodValues.length / 2));

		const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
		const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

		const change = secondAvg - firstAvg;
		return Math.abs(change) < 0.5 ? 'stable' : (change > 0 ? 'improving' : 'declining');
	}

	private calculateSourceBreakdown(stats: UserDailyStats[]): { journal: number; trackers: number; moodEntries: number } {
		const totals = { journal: 0, trackers: 0, moodEntries: 0 };

		stats.forEach(stat => {
			totals.journal += stat.moodSources.journal;
			totals.trackers += stat.moodSources.trackers;
			totals.moodEntries += stat.moodSources.moodEntries;
		});

		return totals;
	}

	private calculateActivityCorrelation(stats: UserDailyStats[]): number {
		return this.calculateCorrelation(stats, 'overallAverageMood', 'totalActivities');
	}

	private calculateCorrelation(stats: UserDailyStats[], field1: keyof UserDailyStats, field2: keyof UserDailyStats): number {
		if (stats.length < 2) return 0;

		const values1 = stats.map(s => Number(s[field1]) || 0);
		const values2 = stats.map(s => Number(s[field2]) || 0);

		return this.pearsonCorrelation(values1, values2);
	}

	private pearsonCorrelation(x: number[], y: number[]): number {
		if (x.length !== y.length || x.length < 2) return 0;

		const n = x.length;
		const sumX = x.reduce((a, b) => a + b, 0);
		const sumY = y.reduce((a, b) => a + b, 0);
		const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
		const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
		const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

		const numerator = n * sumXY - sumX * sumY;
		const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

		if (denominator === 0) return 0;

		return numerator / denominator;
	}

	private aggregateByWeek(stats: UserDailyStats[], field: keyof UserDailyStats): WeeklyMoodTrend[] {
		const weeklyData: { [week: string]: { sum: number; count: number; dates: string[] } } = {};

		stats.forEach(stat => {
			const date = new Date(stat.date);
			const weekStart = this.getWeekStart(date);
			const weekKey = weekStart.toISOString().split('T')[0];

			if (!weeklyData[weekKey]) {
				weeklyData[weekKey] = { sum: 0, count: 0, dates: [] };
			}

			const value = Number(stat[field]) || 0;
			if (value > 0) {
				weeklyData[weekKey].sum += value;
				weeklyData[weekKey].count++;
			}
			weeklyData[weekKey].dates.push(stat.date);
		});

		return Object.keys(weeklyData)
			.sort()
			.map(week => ({
				week,
				averageMood: weeklyData[week].count > 0 ?
					Math.round((weeklyData[week].sum / weeklyData[week].count) * 10) / 10 : 0,
				entryCount: weeklyData[week].count
			}));
	}

	private getWeekStart(date: Date): Date {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
		return new Date(d.setDate(diff));
	}

	// ===============================
	// CACHE MANAGEMENT
	// ===============================

	private getCachedData(key: string): any {
		const cached = this.cache[key];
		if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
			return cached.data;
		}
		return null;
	}

	private setCachedData(key: string, data: any): void {
		this.cache[key] = {
			data,
			timestamp: Date.now()
		};
	}

	private clearCache(): void {
		this.cache = {};
		this.logging.debug('Statistics cache cleared');
	}

	/**
	 * Clear cache for a specific type of data
	 */
	clearCacheForType(type: 'user' | 'tracker' | 'journal' | 'mood' | 'performance' | 'all'): void {
		if (type === 'all') {
			this.clearCache();
			return;
		}

		const keysToDelete = Object.keys(this.cache).filter(key => key.includes(type));
		keysToDelete.forEach(key => delete this.cache[key]);

		this.logging.debug(`Cleared ${type} statistics cache`, { clearedKeys: keysToDelete.length });
	}
} 