import { of, firstValueFrom } from 'rxjs';

import { Tab1Page } from './tab1.page';

describe('Tab1Page', () => {
  let component: Tab1Page;
  const noticeKey = 'regen28.feed.sanctuary-notice-dismissed.v1';
  const createPage = () => new Tab1Page(
    { getCurrentUserProfile: () => of({ displayName: 'Test' }) } as any,
    { getTodaysActionsAndInsights: () => of({ actions: [{ id: 'today-action' }], insights: [{ id: 'today-insight' }] }) } as any
  );

  beforeEach(async () => {
    localStorage.removeItem(noticeKey);
    component = createPage();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  afterEach(() => localStorage.removeItem(noticeKey));

  it('remembers notice dismissal across page instances', () => {
    expect(component.showFeedNotice).toBeTrue();
    component.dismissFeedNotice();
    expect(component.showFeedNotice).toBeFalse();
    expect(createPage().showFeedNotice).toBeFalse();
  });

  it('provides the exact guidance IDs to exclude from the timeline', async () => {
    expect((await firstValueFrom(component.todaysGuidance$)).ids).toEqual(['today-action', 'today-insight']);
  });
});
