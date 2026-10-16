import { TestBed } from '@angular/core/testing';
import { FeedActionCardComponent } from './feed-action-card.component';
import { FeedInsightCardComponent } from '../feed-insight-card/feed-insight-card.component';

describe('Expandable feed cards', () => {
  for (const type of ['action', 'insight']) {
    it(`keeps a long expanded ${type} explanation inside the card at phone width`, async () => {
      const cardType = type === 'action' ? FeedActionCardComponent : FeedInsightCardComponent;
      await TestBed.configureTestingModule({ imports: [cardType] }).compileComponents();
      const fixture = TestBed.createComponent(cardType as typeof FeedActionCardComponent);
      fixture.nativeElement.style.width = '320px';
      fixture.componentInstance.item = {
        source: { trackerName: 'Meditation' },
        body: 'Small intentional actions support a consistent routine. '.repeat(8),
        metadata: { reason: 'A longer explanation with context and practical advice. '.repeat(35),
          dataPoint: 'A longer explanation with context and practical advice. '.repeat(35) }
      } as any;
      fixture.detectChanges();
      fixture.nativeElement.querySelector('button').click();
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector(`.${type}-card`) as HTMLElement;
      const explanation = fixture.nativeElement.querySelector(type === 'action' ? '.reason-text' : '.data-text') as HTMLElement;
      expect(card.classList.contains('expanded')).toBeTrue();
      expect(card.getBoundingClientRect().height).toBeGreaterThan(320);
      expect(explanation.getBoundingClientRect().bottom).toBeLessThanOrEqual(card.getBoundingClientRect().bottom);
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      expect(fixture.nativeElement.querySelector('button').getAttribute('aria-expanded')).toBe('true');
      fixture.destroy();
    });
  }
});
