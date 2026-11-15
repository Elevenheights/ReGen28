import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { Tab2Page } from './tab2.page';
import { UserService } from '../../../services/user.service';
import { JournalService } from '../../../services/journal.service';
import { StatisticsService } from '../../../services/statistics.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';

describe('Journal editorial navigation', () => {
  it('opens the selected saved entry without writing to user data', async () => {
    spyOn(Tab2Page.prototype, 'ngOnInit');
    await TestBed.configureTestingModule({
      imports: [Tab2Page],
      providers: [provideRouter([]),
        { provide: UserService, useValue: {} }, { provide: JournalService, useValue: {} },
        { provide: StatisticsService, useValue: {} }, { provide: LoggingService, useValue: { debug: () => {} } },
        { provide: ToastService, useValue: {} }, { provide: ModalController, useValue: {} }]
    }).compileComponents();
    const fixture = TestBed.createComponent(Tab2Page);
    const page = fixture.componentInstance;
    // This test exercises presentation/navigation with an already-loaded view model.
    page.isLoadingStats = false;
    page.isLoadingEntries = false;
    page.recentEntries = [{ id: 'reflection-42', title: 'A quiet morning', date: new Date(), mood: 8 } as any];
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    const entry: HTMLButtonElement = fixture.nativeElement.querySelector('.journal-entry');
    expect(entry.textContent).toContain('A quiet morning');
    expect(entry.querySelector('[aria-label="Mood: 8 of 10"]')).toBeTruthy();
    entry.click();
    expect(navigate).toHaveBeenCalledWith(['/journal-entry', 'reflection-42']);
  });
});
