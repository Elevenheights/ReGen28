export interface MoodDay {
  date: Date;
  value: number | null;
  entries: number;
}
export interface ActivityDay {
  date: Date;
  count: number;
}

export function localDayKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

export function chartDates(days: number, today = new Date()): Date[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days + index + 1);
    return date;
  });
}

export function recordDate(value: any): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return value?.toDate ? value.toDate() : new Date(value);
}

export function dailyMoods(
  entries: { date: any; mood?: number }[],
  days: number,
  today = new Date(),
): MoodDay[] {
  const buckets = new Map<string, number[]>();
  for (const entry of entries) {
    const date = recordDate(entry.date);
    if (
      !Number.isFinite(date.getTime()) ||
      !Number.isFinite(entry.mood) ||
      entry.mood! < 1 ||
      entry.mood! > 10
    )
      continue;
    const key = localDayKey(date);
    buckets.set(key, [...(buckets.get(key) || []), entry.mood!]);
  }
  return chartDates(days, today).map((date) => {
    const values = buckets.get(localDayKey(date)) || [];
    return {
      date,
      entries: values.length,
      value: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
    };
  });
}

export function activityDays(
  stats: { date: any; totalActivities?: number }[],
  today = new Date(),
): ActivityDay[] {
  const buckets = new Map<string, number>();
  for (const stat of stats) {
    const date = recordDate(stat.date);
    if (!Number.isFinite(date.getTime())) continue;
    const key = localDayKey(date);
    buckets.set(
      key,
      Math.max(buckets.get(key) || 0, Number(stat.totalActivities) || 0),
    );
  }
  return chartDates(7, today).map((date) => ({
    date,
    count: buckets.get(localDayKey(date)) || 0,
  }));
}
