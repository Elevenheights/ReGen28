import { firstValueFrom, of } from 'rxjs';
import { FeedListComponent } from './feed-list.component';

describe('FeedListComponent guidance deduplication', () => {
  it('shows recent days first, with each day unfolding in time order', async () => {
    const items = [
      { id: 'coach', createdAt: new Date(2026, 10, 15, 10, 30) },
      { id: 'yesterday', createdAt: { toDate: () => new Date(2026, 10, 14, 18) } },
      { id: 'morning', createdAt: new Date(2026, 10, 15, 8, 10) },
    ];
    const component = new FeedListComponent({ getFeed: () => of(items) } as any);
    component.timelineLayout = true;
    component.ngOnInit();
    expect((await firstValueFrom(component.feedItems$)).map(i => i.id)).toEqual(['morning', 'coach', 'yesterday']);
    expect(items.map(i => i.id)).toEqual(['coach', 'yesterday', 'morning']);
  });
  it('excludes only posts already shown in today guidance', async () => {
    const component = new FeedListComponent({ getFeed: () => of([
      { id: 'today-action' }, { id: 'old-action' }, { id: 'welcome' }
    ]) } as any);
    component.excludedItemIds = ['today-action'];
    component.ngOnInit();
    expect((await firstValueFrom(component.feedItems$)).map(i => i.id)).toEqual(['old-action', 'welcome']);
    component.excludedItemIds = [];
    expect((await firstValueFrom(component.feedItems$)).length).toBe(3);
  });
});
