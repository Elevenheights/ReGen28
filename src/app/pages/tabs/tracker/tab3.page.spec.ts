import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NEVER, of, Subject, throwError, firstValueFrom } from 'rxjs';
import { Tab3Page } from './tab3.page';

describe('Tab3Page', () => {
  let component: Tab3Page;
  let trackers: any;
  let statistics: any;
  const saved = ['Meditation', 'Mindfulness Practice', 'Gratitude Practice'].map((name, index) => ({
    id: `tracker-${index}`, name, category: 'mind', isActive: true, isCompleted: false,
    stats: { currentStreak: 0 }
  }));

  beforeEach(async () => {
    trackers = {
      getUserTrackers: jasmine.createSpy().and.returnValue(of(saved)),
      getTrackerEntries: () => of([]),
      getTodaysEntries: jasmine.createSpy().and.returnValue(of([])),
      getTrackerProgress: () => 0, getDaysRemaining: () => 28
    };
    statistics = { getRecentStats: jasmine.createSpy().and.returnValue(of([])) };
    component = new Tab3Page(
      trackers, { getCurrentUserProfile: () => of({ displayName: 'Test' }) } as any,
      {} as any, {} as any, statistics, {} as any,
      { debug: () => {}, warn: () => {}, error: () => {} } as any,
      { detectChanges: () => {} } as any, {} as any, { queryParams: of({}) } as any,
      {} as any, {} as any, {} as any, {} as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('uses only the selected tracker’s actual recent entries for history', async () => {
    component.activeTrackers = saved as any;
    trackers.getTrackerEntries = jasmine.createSpy().and.returnValue(of([
      { trackerId: saved[1].id, date: new Date() },
      { trackerId: saved[0].id, date: new Date() },
    ]));
    component.selectTracker(saved[1] as any);
    const history = await firstValueFrom(component.focusedHistory$);
    expect(component.focusedTracker?.id).toBe(saved[1].id);
    expect(history.days.length).toBe(7);
    expect(history.days.filter(d => d.logged).length).toBe(1);
    expect(trackers.getTrackerEntries).toHaveBeenCalledWith(saved[1].id, 200);
  });

  it('shows an unavailable history state when the selected tracker cannot be read', async () => {
    trackers.getTrackerEntries = () => throwError(() => new Error('unavailable'));
    component.selectTracker(saved[0] as any);
    const history = await firstValueFrom(component.focusedHistory$);
    expect(history.days).toEqual([]);
    expect(history.error).toContain('unavailable');
  });
  afterEach(() => component.ngOnDestroy());

  it('renders saved trackers even when statistics fail', fakeAsync(() => {
    statistics.getRecentStats.and.returnValue(throwError(() => new Error('stats unavailable')));
    component.ngOnInit();
    flushMicrotasks();
    expect(component.activeTrackers.map(t => t.name)).toEqual(saved.map(t => t.name));
    expect(component.statisticsUnavailable).toBeTrue();
    expect(component.isLoading).toBeFalse();
  }));

  it('does not wait for statistics to show saved trackers', fakeAsync(() => {
    statistics.getRecentStats.and.returnValue(NEVER);
    component.ngOnInit();
    flushMicrotasks();
    expect(component.activeTrackers.length).toBe(3);
    expect(component.isLoading).toBeFalse();
    component.ngOnDestroy();
  }));

  it('keeps trackers visible if today entry lookup fails', fakeAsync(() => {
    trackers.getTodaysEntries.and.returnValue(throwError(() => new Error('entries unavailable')));
    component.ngOnInit();
    flushMicrotasks();
    expect(component.activeTrackers.length).toBe(3);
    expect(component.loadError).toBe('');
  }));

  it('reports tracker read failures rather than presenting them as an empty account', () => {
    trackers.getUserTrackers.and.returnValue(throwError(() => new Error('permission denied')));
    component.ngOnInit();
    expect(component.loadError).toContain('could not be loaded');
    expect(component.isLoading).toBeFalse();
  });

  it('refresh replaces the previous data subscription', fakeAsync(() => {
    const source = new Subject<any[]>();
    trackers.getUserTrackers.and.returnValue(source);
    component.ngOnInit();
    expect(source.observers.length).toBe(1);
    component.handleRefresh({ target: { complete: () => {} } });
    flushMicrotasks();
    expect(source.observers.length).toBe(1);
  }));
});
