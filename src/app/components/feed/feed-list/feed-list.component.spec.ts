import { firstValueFrom, of } from 'rxjs';
import { FeedListComponent } from './feed-list.component';

describe('FeedListComponent guidance deduplication', () => {
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
