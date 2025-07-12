import { Injectable } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, collection, addDoc, query, where, getDocs, orderBy, deleteDoc, DocumentData, DocumentReference } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { JournalEntry, JournalPrompt, JournalStats, JournalCategory } from '../models/journal.interface';
import { Observable, map, switchMap, of, combineLatest } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class JournalService {

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private userService: UserService
  ) {}

  // Create a new journal entry
  async createJournalEntry(entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    const entry: Omit<JournalEntry, 'id'> = {
      ...entryData,
      userId: authUser.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const entriesCollection = collection(this.firestore, 'journal-entries');
    const docRef = await addDoc(entriesCollection, entry);

    // Update user stats
    await this.userService.incrementStat('totalJournalEntries');

    return docRef.id;
  }

  // Get all journal entries for current user
  getUserJournalEntries(limit: number = 50): Observable<JournalEntry[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const entriesQuery = query(
          collection(this.firestore, 'journal-entries'),
          where('userId', '==', authUser.uid),
          orderBy('date', 'desc')
        );
        
        return getDocs(entriesQuery).then(snapshot => 
          snapshot.docs.slice(0, limit).map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry))
        );
      })
    );
  }

  // Get single journal entry by ID
  getJournalEntry(entryId: string): Observable<JournalEntry | null> {
    const entryDoc = doc(this.firestore, `journal-entries/${entryId}`);
    return docData(entryDoc as any, { idField: 'id' }) as Observable<JournalEntry>;
  }

  // Update journal entry
  async updateJournalEntry(entryId: string, updates: Partial<JournalEntry>): Promise<void> {
    const entryDoc = doc(this.firestore, `journal-entries/${entryId}`);
    await updateDoc(entryDoc, {
      ...updates,
      updatedAt: new Date()
    });
  }

  // Delete journal entry (soft delete)
  async deleteJournalEntry(entryId: string): Promise<void> {
    const entryDoc = doc(this.firestore, `journal-entries/${entryId}`);
    await updateDoc(entryDoc, {
      isDeleted: true,
      deletedAt: new Date()
    });
  }

  // Search journal entries by text content
  searchJournalEntries(searchTerm: string): Observable<JournalEntry[]> {
    return this.getUserJournalEntries().pipe(
      map(entries => entries.filter(entry => 
        entry.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      ))
    );
  }

  // Get journal entries by date range
  getJournalEntriesByDateRange(startDate: Date, endDate: Date): Observable<JournalEntry[]> {
    return this.authService.user$.pipe(
      switchMap(authUser => {
        if (!authUser) return of([]);
        
        const entriesQuery = query(
          collection(this.firestore, 'journal-entries'),
          where('userId', '==', authUser.uid),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'desc')
        );
        
        return getDocs(entriesQuery).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry))
        );
      })
    );
  }

  // Get recent journal entries for dashboard
  getRecentJournalEntries(limit: number = 5): Observable<JournalEntry[]> {
    return this.getUserJournalEntries(limit);
  }

  // Calculate journal statistics
  async calculateJournalStats(): Promise<JournalStats> {
    const authUser = this.authService.getCurrentUser();
    if (!authUser) throw new Error('No authenticated user');

    // Get all journal entries
    const entriesQuery = query(
      collection(this.firestore, 'journal-entries'),
      where('userId', '==', authUser.uid),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(entriesQuery);
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));

    const totalEntries = entries.length;

    // Calculate weekly count
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneWeekAgo;
    });
    
    const weeklyCount = weeklyEntries.length;

    // Calculate streak days
    const streakDays = this.calculateJournalStreak(entries);

    // Calculate average mood
    const entriesWithMood = entries.filter(entry => entry.mood !== undefined);
    const avgMood = entriesWithMood.length > 0 
      ? Math.round(entriesWithMood.reduce((sum, entry) => sum + (entry.mood || 0), 0) / entriesWithMood.length * 10) / 10
      : 0;

    return {
      userId: authUser.uid,
      totalEntries,
      weeklyCount,
      monthlyCount: 0,
      currentStreak: streakDays,
      longestStreak: 0,
      averageMood: avgMood,
      moodTrend: 0,
      totalWords: 0,
      averageWordsPerEntry: 0,
      mostUsedTags: [],
      favoriteCategories: [],
      sentimentTrend: 0,
      emotionalRange: 0,
      lastUpdated: new Date()
    } as JournalStats;
  }

  // Calculate current journal writing streak
  private calculateJournalStreak(entries: JournalEntry[]): number {
    if (entries.length === 0) return 0;

    // Sort entries by date (most recent first)
    const sortedEntries = entries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const entry of sortedEntries) {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);

      // Check if entry is for the current date we're checking
      if (entryDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (entryDate.getTime() < currentDate.getTime()) {
        // Gap in entries, streak is broken
        break;
      }
    }

    return streak;
  }

  // Get journal dashboard data
  getJournalDashboardData(): Observable<{
    recentEntries: JournalEntry[];
    stats: JournalStats;
    prompts: JournalPrompt[];
  }> {
    return combineLatest([
      this.getRecentJournalEntries(5),
      this.getJournalPrompts()
    ]).pipe(
      switchMap(async ([recentEntries, prompts]) => {
        const stats = await this.calculateJournalStats();
        return {
          recentEntries,
          stats,
          prompts: prompts.slice(0, 3) // Show 3 prompts
        };
      })
    );
  }

  // Get mood analytics from journal entries
  getMoodAnalytics(days: number = 30): Observable<{
    averageMood: number;
    moodTrend: 'improving' | 'declining' | 'stable';
    moodDistribution: { [key: number]: number };
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getJournalEntriesByDateRange(startDate, new Date()).pipe(
      map(entries => {
        const entriesWithMood = entries.filter(entry => entry.mood !== undefined);
        
        if (entriesWithMood.length === 0) {
          return {
            averageMood: 0,
            moodTrend: 'stable' as const,
            moodDistribution: {}
          };
        }

        // Calculate average mood
        const averageMood = entriesWithMood.reduce((sum, entry) => sum + (entry.mood || 0), 0) / entriesWithMood.length;

        // Calculate mood trend (compare first half vs second half)
        const midPoint = Math.floor(entriesWithMood.length / 2);
        const firstHalf = entriesWithMood.slice(0, midPoint);
        const secondHalf = entriesWithMood.slice(midPoint);

        const firstHalfAvg = firstHalf.reduce((sum, entry) => sum + (entry.mood || 0), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, entry) => sum + (entry.mood || 0), 0) / secondHalf.length;

        let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
        const trendDiff = secondHalfAvg - firstHalfAvg;
        if (trendDiff > 0.3) moodTrend = 'improving';
        else if (trendDiff < -0.3) moodTrend = 'declining';

        // Calculate mood distribution
        const moodDistribution: { [key: number]: number } = {};
        entriesWithMood.forEach(entry => {
          const mood = entry.mood || 0;
          moodDistribution[mood] = (moodDistribution[mood] || 0) + 1;
        });

        return {
          averageMood: Math.round(averageMood * 10) / 10,
          moodTrend,
          moodDistribution
        };
      })
    );
  }

  // Journal Prompts Management

  // Get default journal prompts
  getJournalPrompts(): Observable<JournalPrompt[]> {
    return of(this.getDefaultPrompts());
  }

  // Get daily prompt suggestion
  getDailyPrompt(): Observable<JournalPrompt> {
    const prompts = this.getDefaultPrompts();
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const promptIndex = dayOfYear % prompts.length;
    
    return of(prompts[promptIndex]);
  }

  // Get prompts by category
  getPromptsByCategory(category: string): Observable<JournalPrompt[]> {
    return this.getJournalPrompts().pipe(
      map(prompts => prompts.filter(prompt => prompt.category === category))
    );
  }

  // Default journal prompts
  private getDefaultPrompts(): JournalPrompt[] {
    return [
      {
        id: 'prompt-1',
        text: 'What are three things you\'re grateful for today?',
        icon: 'fa-heart',
        category: JournalCategory.GRATITUDE,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-2',
        text: 'How did you take care of yourself today?',
        icon: 'fa-spa',
        category: JournalCategory.HEALTH,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-3',
        text: 'What was the highlight of your day?',
        icon: 'fa-star',
        category: JournalCategory.REFLECTION,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-4',
        text: 'What challenge did you overcome today?',
        icon: 'fa-mountain',
        category: JournalCategory.GROWTH,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-5',
        text: 'How do you want to feel tomorrow?',
        icon: 'fa-seedling',
        category: JournalCategory.GOALS,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-6',
        text: 'What did you learn about yourself today?',
        icon: 'fa-lightbulb',
        category: JournalCategory.CUSTOM,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-7',
        text: 'Describe a moment when you felt truly present today.',
        icon: 'fa-leaf',
        category: JournalCategory.MINDFULNESS,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-8',
        text: 'What acts of kindness did you witness or perform?',
        icon: 'fa-hands-helping',
        category: JournalCategory.CUSTOM,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-9',
        text: 'What energy did you bring to your interactions today?',
        icon: 'fa-users',
        category: JournalCategory.RELATIONSHIPS,
        createdAt: new Date(),
        isActive: true
      },
      {
        id: 'prompt-10',
        text: 'How did your body feel today, and what did it need?',
        icon: 'fa-heart-pulse',
        category: JournalCategory.HEALTH,
        createdAt: new Date(),
        isActive: true
      }
    ];
  }

  // Export journal entries (for backup/sharing)
  async exportJournalEntries(format: 'json' | 'txt' = 'json'): Promise<string> {
    const entries = await this.getUserJournalEntries().pipe(
      switchMap(entries => of(entries))
    ).toPromise();

    if (!entries) return '';

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      // Plain text format
      return entries.map(entry => {
        const date = new Date(entry.date).toDateString();
        return `${date}\n${entry.title || 'Untitled'}\n\n${entry.content}\n\n---\n\n`;
      }).join('');
    }
  }
} 