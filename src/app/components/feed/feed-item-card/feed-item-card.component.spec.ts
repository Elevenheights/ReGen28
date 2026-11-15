import { Subject, of, throwError } from 'rxjs';
import { FeedItemCardComponent } from './feed-item-card.component';
import { CommentsModalComponent } from '../comments-modal/comments-modal.component';

describe('Restored feed interactions', () => {
  let page: FeedItemCardComponent;
  let feed: any, modal: any, toast: any, tracker: any, logger: any, alert: any;
  beforeEach(() => {
    feed = {
      toggleLike: jasmine
        .createSpy()
        .and.returnValue(of({ likesCount: 1, hasLiked: true })),
    };
    const dialog = { present: jasmine.createSpy().and.resolveTo() };
    modal = { create: jasmine.createSpy().and.resolveTo(dialog) };
    toast = { showError: jasmine.createSpy(), showInfo: jasmine.createSpy() };
    tracker = {
      getTracker: jasmine
        .createSpy()
        .and.returnValue(of({ id: 'walk', target: 10 })),
      updateTracker: jasmine.createSpy().and.resolveTo(),
    };
    logger = { openLogModal: jasmine.createSpy() };
    alert = { create: jasmine.createSpy().and.resolveTo(dialog) };
    page = new FeedItemCardComponent(
      feed,
      modal,
      toast,
      tracker,
      logger,
      alert,
    );
    page.item = {
      id: 'post',
      source: { trackerId: 'walk' },
      likesCount: 0,
    } as any;
  });
  it('restores liking and prevents duplicate requests while one is pending', () => {
    const result = new Subject<any>();
    feed.toggleLike.and.returnValue(result);
    page.toggleLike();
    page.toggleLike();
    expect(feed.toggleLike).toHaveBeenCalledOnceWith('post');
    result.next({ likesCount: 1, hasLiked: true });
    result.complete();
    expect(page.item.hasLiked).toBeTrue();
    expect(page.liking).toBeFalse();
  });
  it('restores counts after a rejected like', () => {
    feed.toggleLike.and.returnValue(throwError(() => new Error('offline')));
    page.toggleLike();
    expect(page.item.likesCount).toBe(0);
    expect(page.item.hasLiked).toBeFalse();
    expect(toast.showError).toHaveBeenCalled();
  });
  it('opens comments for the exact post and opens the linked tracker logger', async () => {
    await page.openComments();
    await page.keepGoing();
    expect(modal.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        component: CommentsModalComponent,
        componentProps: { feedItemId: 'post' },
      }),
    );
    expect(logger.openLogModal).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 'walk' }),
    );
  });
  it('requires a reviewed valid target before saving a coaching adjustment', async () => {
    await page.makeItLighter();
    expect(tracker.updateTracker).not.toHaveBeenCalled();
    const save = alert.create.calls.mostRecent().args[0].buttons[1].handler;
    expect(await save({ target: 0 })).toBeFalse();
    expect(tracker.updateTracker).not.toHaveBeenCalled();
    expect(await save({ target: 5 })).toBeTrue();
    expect(tracker.updateTracker).toHaveBeenCalledWith('walk', { target: 5 });
  });
  it('retains supplementary metrics without repeating the main tracker value', () => {
    page.item = {
      ...page.item,
      type: 'trackerEntry',
      metrics: [
        { label: 'Duration', value: 10, unit: 'min' },
        { label: 'Energy', value: 4, unit: 'of 5' },
      ],
    };
    expect(page.hasSpecializedVisual).toBeTrue();
    expect(page.displayMetrics?.map((metric) => metric.label)).toEqual([
      'Energy',
    ]);
    page.item.media = {
      status: 'ready',
      images: [{ url: 'sample.jpg', kind: 'card' }],
    } as any;
    expect(page.hasSpecializedVisual).toBeFalse();
    expect(page.displayMetrics?.length).toBe(2);
  });
});
