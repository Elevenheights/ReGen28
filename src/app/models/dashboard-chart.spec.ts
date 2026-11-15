import {
  activityDays,
  chartDates,
  dailyMoods,
  localDayKey,
} from './dashboard-chart';

describe('Dashboard chart records', () => {
  const today = new Date(2026, 10, 15, 12);
  it('keeps local date-only records on the right day and averages multiple check-ins', () => {
    const series = dailyMoods(
      [
        { date: '2026-11-15', mood: 8 },
        { date: '2026-11-15', mood: 10 },
        { date: '2026-11-14', mood: 2 },
      ],
      7,
      today,
    );
    expect(series[6].value).toBe(9);
    expect(series[6].entries).toBe(2);
    expect(series[5].value).toBe(2);
    expect(series[4].value).toBeNull();
  });
  it('uses a real 30-day window without substituting a weekly average', () => {
    const series = dailyMoods(
      [
        { date: '2026-10-20', mood: 6 },
        { date: '2026-11-15', mood: 9 },
        { date: '2026-11-15', mood: 11 },
      ],
      30,
      today,
    );
    expect(series.length).toBe(30);
    expect(series.filter((day) => day.value !== null).length).toBe(2);
    expect(series[29].value).toBe(9);
  });
  it('aligns unsorted activity rows by date and does not double count duplicate daily snapshots', () => {
    const days = activityDays(
      [
        { date: '2026-11-15', totalActivities: 3 },
        { date: '2026-11-13', totalActivities: 1 },
        { date: '2026-11-15', totalActivities: 3 },
      ],
      today,
    );
    expect(days.map((day) => day.count)).toEqual([0, 0, 0, 0, 1, 0, 3]);
    expect(localDayKey(chartDates(7, today)[0])).toBe('2026-11-09');
  });
});
