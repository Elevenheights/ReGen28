
import { TrackerFrequency } from '../shared-config';

/**
 * Calculates user's age from birthday string
 */
export function calculateAge(birthday: string): number {
	const birthDate = new Date(birthday);
	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
}

/**
 * Gets user's current date and time in their timezone
 */
export function getUserCurrentDateTime(userTimezone: string): { formattedDateTime: string; dayOfWeek: string; dateKey: string } {
	const now = new Date();
	const formattedDateTime = now.toLocaleString('en-US', { timeZone: userTimezone });
	const dayOfWeek = now.toLocaleString('en-US', { timeZone: userTimezone, weekday: 'long' });

	// Create a date key (YYYY-MM-DD) for the user's current date in their timezone
	const userDate = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
	const dateKey = userDate.toISOString().split('T')[0];

	return { formattedDateTime, dayOfWeek, dateKey };
}

/**
 * Calculates tracker analytics for the last N days
 */
export async function calculateTrackerAnalytics(db: any, trackerId: string, userId: string, days: number, trackerData?: any) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	const startDateKey = startDate.toISOString().split('T')[0];

	const entriesSnapshot = await db.collection('tracker-entries')
		.where('trackerId', '==', trackerId)
		.where('userId', '==', userId)
		.where('date', '>=', startDateKey)
		.orderBy('date', 'desc')
		.get();

	const entries = entriesSnapshot.docs.map((doc: any) => doc.data());

	if (entries.length === 0) {
		return {
			hasEntries: false,
			totalEntries: 0
		};
	}

	const completionRate = Math.round((entries.length / days) * 100);
	const trackerFrequency = trackerData?.frequency || TrackerFrequency.DAILY;
	const { currentStreak, longestStreak } = calculateStreaks(entries, days, trackerFrequency);

	const averageValue = entries.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0) / entries.length;
	const moodEntries = entries.filter((e: any) => e.mood);
	const averageMood = moodEntries.length > 0 ? moodEntries.reduce((sum: number, entry: any) => sum + entry.mood, 0) / moodEntries.length : 0;

	const energyEntries = entries.filter((e: any) => e.energy);
	const averageEnergy = energyEntries.length > 0 ? energyEntries.reduce((sum: number, entry: any) => sum + entry.energy, 0) / energyEntries.length : 0;

	const dayStats = analyzeDayPatterns(entries);

	const recentEntries = entries.slice(0, 7);
	const olderEntries = entries.slice(-7);
	const recentAvg = recentEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0) / Math.max(recentEntries.length, 1);
	const olderAvg = olderEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0) / Math.max(olderEntries.length, 1);

	let trend = 'stable';
	if (recentAvg > olderAvg * 1.1) trend = 'improving';
	else if (recentAvg < olderAvg * 0.9) trend = 'declining';

	return {
		hasEntries: true,
		totalEntries: entries.length,
		completionRate,
		currentStreak,
		longestStreak,
		averageValue: Math.round(averageValue * 10) / 10,
		bestDays: dayStats.best,
		challengingDays: dayStats.challenging,
		trend,
		averageMood: Math.round(averageMood * 10) / 10,
		averageEnergy: Math.round(averageEnergy * 10) / 10
	};
}

function calculateStreaks(entries: any[], totalDays: number, frequency: TrackerFrequency = TrackerFrequency.DAILY) {
	if (entries.length === 0) return { currentStreak: 0, longestStreak: 0 };
	const sortedEntries = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	switch (frequency) {
		case TrackerFrequency.DAILY:
			return calculateDailyStreaks(sortedEntries, totalDays);
		case TrackerFrequency.WEEKLY:
			return calculateWeeklyStreaks(sortedEntries);
		case TrackerFrequency.MONTHLY:
			return calculateMonthlyStreaks(sortedEntries);
		default:
			return calculateDailyStreaks(sortedEntries, totalDays);
	}
}

function calculateDailyStreaks(sortedEntries: any[], totalDays: number) {
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;
	const today = new Date();
	let checkDate = new Date(today);

	for (let i = 0; i < totalDays; i++) {
		const dateKey = checkDate.toISOString().split('T')[0];
		const hasEntry = sortedEntries.some(entry => entry.date === dateKey);

		if (hasEntry) {
			if (i === 0 || currentStreak > 0) currentStreak++;
			tempStreak++;
			longestStreak = Math.max(longestStreak, tempStreak);
		} else {
			if (i === 0) currentStreak = 0;
			tempStreak = 0;
		}
		checkDate.setDate(checkDate.getDate() - 1);
	}
	return { currentStreak, longestStreak };
}

function calculateWeeklyStreaks(sortedEntries: any[]) {
	// Simple weekly streak: at least one entry per ISO week
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;

	const weeks = new Map<string, boolean>();
	sortedEntries.forEach(entry => {
		const date = new Date(entry.date);
		const year = date.getFullYear();
		const weekNum = getWeekNumber(date);
		weeks.set(`${year}-W${weekNum}`, true);
	});

	const now = new Date();
	let currentWeek = getWeekNumber(now);
	let currentYear = now.getFullYear();

	for (let i = 0; i < 52; i++) {
		if (weeks.has(`${currentYear}-W${currentWeek}`)) {
			if (i === 0 || currentStreak > 0) currentStreak++;
			tempStreak++;
			longestStreak = Math.max(longestStreak, tempStreak);
		} else {
			if (i === 0) currentStreak = 0;
			tempStreak = 0;
		}

		currentWeek--;
		if (currentWeek === 0) {
			currentYear--;
			currentWeek = 52;
		}
	}

	return { currentStreak, longestStreak };
}

function calculateMonthlyStreaks(sortedEntries: any[]) {
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;

	const months = new Map<string, boolean>();
	sortedEntries.forEach(entry => {
		const date = new Date(entry.date);
		const year = date.getFullYear();
		const month = date.getMonth();
		months.set(`${year}-${month}`, true);
	});

	const now = new Date();
	let currentMonth = now.getMonth();
	let currentYear = now.getFullYear();

	for (let i = 0; i < 12; i++) {
		if (months.has(`${currentYear}-${currentMonth}`)) {
			if (i === 0 || currentStreak > 0) currentStreak++;
			tempStreak++;
			longestStreak = Math.max(longestStreak, tempStreak);
		} else {
			if (i === 0) currentStreak = 0;
			tempStreak = 0;
		}

		currentMonth--;
		if (currentMonth < 0) {
			currentYear--;
			currentMonth = 11;
		}
	}

	return { currentStreak, longestStreak };
}

function getWeekNumber(d: Date): number {
	d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	return weekNo;
}

function analyzeDayPatterns(entries: any[]) {
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const counts = new Array(7).fill(0);

	entries.forEach(entry => {
		const day = new Date(entry.date).getDay();
		counts[day]++;
	});

	const max = Math.max(...counts);
	const min = Math.min(...counts);

	return {
		best: days.filter((_, i) => counts[i] === max && max > 0),
		challenging: days.filter((_, i) => counts[i] === min && min < max)
	};
}

/**
 * Get current date and hour in a specific timezone
 */
export function getUserLocalTime(timezone: string = 'UTC') {
	const now = new Date();
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			hour12: false
		});

		const parts = formatter.formatToParts(now);
		const year = parts.find(p => p.type === 'year')?.value;
		const month = parts.find(p => p.type === 'month')?.value;
		const day = parts.find(p => p.type === 'day')?.value;
		const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');

		return {
			hour,
			dateKey: `${year}-${month}-${day}`,
			fullDate: now
		};
	} catch (e) {
		return {
			hour: now.getUTCHours(),
			dateKey: now.toISOString().split('T')[0],
			fullDate: now
		};
	}
}
