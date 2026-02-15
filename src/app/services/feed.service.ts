import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of, catchError, switchMap, combineLatest } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { collection, query, where, orderBy, limit as firestoreLimit, onSnapshot, Firestore } from '@angular/fire/firestore';
import { DatabaseService, TrackerSpecificSuggestionsResponse } from './database.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { FeedItem, FeedItemType, FeedComment } from '../models/feed-item.interface';
import { Activity, ActivityType } from '../models/activity.interface';
import { ActivityService } from './activity.service';
import { StatisticsService } from './statistics.service';

import { TrackerService } from './tracker.service';

/** Default Regen28 Coach avatar (Dicebear) */


@Injectable({
	providedIn: 'root'
})
export class FeedService {
	private readonly COLLECTION_NAME = 'feed-items';
	private functions = inject(Functions);

	constructor(
		private firestore: Firestore,
		private databaseService: DatabaseService,
		private authService: AuthService,
		private userService: UserService,
		private activityService: ActivityService,
		private statisticsService: StatisticsService,

		private trackerService: TrackerService
	) { }

	/**
	 * Get the feed for the current user.
	 * Now reads from feed-items collection for actions/insights, and maps activities for other posts.
	 */
	getFeed(limitCount: number = 20): Observable<FeedItem[]> {
		return this.authService.user$.pipe(
			switchMap(user => {
				console.log('[FeedService] getFeed user state:', user ? user.uid : 'null');
				if (!user) return of([]);

				return combineLatest([
					this.getFeedItemsFromFirestore(user.uid, limitCount),
					this.activityService.getRecentActivities(limitCount),
					this.statisticsService.getTodaysStats().pipe(catchError(() => of(null))),
					this.userService.getCurrentUserProfile().pipe(catchError(() => of(null)))
				]).pipe(
					switchMap(async ([feedItems, activities, dailyStats, userProfile]) => {
						// Resolve user avatar URL
						const userAvatarUrl = userProfile?.photoURL
							|| `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${userProfile?.displayName || user.displayName || 'user'}`;
						const userDisplayName = userProfile?.displayName || user.displayName || 'You';

						// Map activities to feed items (for tracker entries, journal, etc.)
						const activityItems = this.mapActivitiesToFeedItems(activities, userAvatarUrl, userDisplayName);

						// Combine feed items from Firestore with activity-based items
						const allItems = [...feedItems, ...activityItems];



						// Sort all items by createdAt (most recent first)
						allItems.sort((a, b) => {
							const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
							const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
							return dateB.getTime() - dateA.getTime();
						});

						return allItems.slice(0, limitCount);
					})
				);
			})
		);
	}

	/**
	 * Get today's action and insight posts for the dashboard
	 */
	getTodaysActionsAndInsights(): Observable<{ actions: FeedItem[]; insights: FeedItem[] }> {
		return this.authService.user$.pipe(
			switchMap(user => {
				if (!user) return of({ actions: [], insights: [] });

				const todayKey = new Date().toISOString().split('T')[0];

				return this.getFeedItemsFromFirestore(user.uid, 100).pipe(
					map(items => {
						const todaysItems = items.filter(item => item.dateKey === todayKey);
						const actions = todaysItems.filter(item => item.type === 'action');
						const insights = todaysItems.filter(item => item.type === 'insight');
						return { actions, insights };
					})
				);
			})
		);
	}

	/**
	 * Get feed items from Firestore (actions, insights, and other AI-generated posts)
	 */
	private getFeedItemsFromFirestore(userId: string, limit: number): Observable<FeedItem[]> {
		return new Observable(observer => {
			const feedItemsRef = collection(this.firestore, 'feed-items'); // Direct access, no checking needed

			if (!feedItemsRef) { // Should not happen with direct injection
				observer.next([]);
				observer.complete();
				return;
			}

			const q = query(
				feedItemsRef,
				where('userId', '==', userId),
				orderBy('createdAt', 'desc'),
				firestoreLimit(limit)
			);

			const unsubscribe = onSnapshot(q, (snapshot) => {
				console.log(`[FeedService] Query for user ${userId} returned ${snapshot.docs.length} docs`);
				if (snapshot.docs.length > 0) {
					const firstData = snapshot.docs[0].data();
					console.log('[FeedService] First doc sample:', {
						id: snapshot.docs[0].id,
						type: firstData['type'],
						createdAt: firstData['createdAt']
					});
				}

				const items: FeedItem[] = snapshot.docs.map(doc => {
					const data = doc.data();
					const item: any = {
						id: doc.id,
						...data,
						createdAt: data['createdAt']?.toDate?.() || data['createdAt'],
						updatedAt: data['updatedAt']?.toDate?.() || data['updatedAt']
					};

					// Map legacy/generator imageUrl to media structure
					if (data['imageUrl'] && !item.media) {
						item.media = {
							images: [{ url: data['imageUrl'] }],
							status: 'ready'
						};
					}

					return item as FeedItem;
				});
				observer.next(items);
			}, (error) => {
				console.error('Error fetching feed items:', error);
				observer.next([]);
			});

			return () => unsubscribe();
		});
	}



	/**
	 * Maps legacy Activity objects to the new FeedItem structure
	 */
	private mapActivitiesToFeedItems(activities: Activity[], userAvatarUrl: string, userDisplayName: string): FeedItem[] {
		return activities.map(activity => {
			const feedItem: FeedItem = {
				id: `mapped_${activity.id}`,
				userId: activity.userId,
				type: this.mapActivityTypeToFeedType(activity.type),
				title: activity.title,
				subtitle: activity.description,
				body: activity.description || activity.title, // Use description as caption
				source: {
					kind: 'activity',
					id: activity.id
				},
				visibility: 'private',
				createdAt: activity.createdAt,
				updatedAt: activity.createdAt,
				metrics: [],
				media: {
					status: 'none'
				},
				author: {
					name: userDisplayName,
					avatarUrl: userAvatarUrl,
					location: 'Home'
				},
				likesCount: 0,
				commentsCount: 0,
				tags: ['activity']
			};

			// Enrich based on activity type
			if (activity.value !== undefined) {
				feedItem.metrics?.push({
					label: 'Value',
					value: activity.value,
					unit: activity.unit
				});
			}

			if (activity.category) {
				feedItem.tags = [activity.category];
			}

			return feedItem;
		});
	}

	private mapActivityTypeToFeedType(activityType: ActivityType): FeedItemType {
		switch (activityType) {
			case ActivityType.TRACKER_ENTRY:
				return 'trackerEntry';
			case ActivityType.JOURNAL_ENTRY:
				return 'journal';
			case ActivityType.GOAL_COMPLETED:
			case ActivityType.MILESTONE_COMPLETED:
				return 'milestone';
			case ActivityType.STREAK_ACHIEVED:
			case ActivityType.STREAK_MILESTONE:
				return 'statCard';
			case ActivityType.ACHIEVEMENT_EARNED:
				return 'milestone';
			default:
				return 'activity';
		}
	}

	/**
	 * Toggles the like status of a feed item.
	 */
	toggleLike(feedItemId: string): Observable<{ likesCount: number; hasLiked: boolean }> {
		const toggleLikeFn = httpsCallable<{ action: string; feedItemId: string }, { likesCount: number; hasLiked: boolean }>(
			this.functions,
			'feedInteractions'
		);
		return from(toggleLikeFn({ action: 'toggle-like', feedItemId })).pipe(
			map(result => result.data)
		);
	}

	/**
	 * Adds a comment to a feed item.
	 */
	addComment(feedItemId: string, text: string): Observable<FeedComment> {
		const addCommentFn = httpsCallable<{ action: string; feedItemId: string; text: string }, FeedComment>(
			this.functions,
			'feedInteractions'
		);
		return from(addCommentFn({ action: 'add-comment', feedItemId, text })).pipe(
			map(result => result.data)
		);
	}

	/**
	 * Gets comments for a feed item.
	 */
	getComments(feedItemId: string, limitCount: number = 20, startAfterId?: string): Observable<FeedComment[]> {
		const getCommentsFn = httpsCallable<{ action: string; feedItemId: string; limit: number; startAfterId?: string }, { comments: FeedComment[] }>(
			this.functions,
			'feedInteractions'
		);
		return from(getCommentsFn({ action: 'get-comments', feedItemId, limit: limitCount, startAfterId })).pipe(
			map(result => result.data.comments)
		);
	}
}
