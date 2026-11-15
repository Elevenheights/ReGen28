import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { Tab4Page } from './tab4.page';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { LoggingService } from '../../../services/logging.service';
import { ToastService } from '../../../services/toast.service';
import { DatabaseService } from '../../../services/database.service';
import { AchievementService } from '../../../services/achievement.service';
import { StatisticsService } from '../../../services/statistics.service';
import { NotificationService } from '../../../services/notification.service';
import { SubscriptionService } from '../../../services/subscription.service';

describe('Account editorial navigation', () => {
  it('keeps membership, privacy and deletion controls accessible', async () => {
    spyOn(Tab4Page.prototype, 'ngOnInit');
    await TestBed.configureTestingModule({
      imports: [Tab4Page],
      providers: [provideRouter([]),
        { provide: UserService, useValue: { isAdmin$: of(false) } },
        { provide: SubscriptionService, useValue: { isPro$: of(true) } },
        ...[AuthService, LoggingService, ToastService, DatabaseService, AchievementService,
          StatisticsService, NotificationService, AlertController, ModalController]
          .map(provide => ({ provide, useValue: {} }))]
    }).compileComponents();
    const fixture = TestBed.createComponent(Tab4Page);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('a[href="/ai-consent"]')).toBeTruthy();
    expect(root.querySelector('.delete-account')?.textContent).toContain('Delete account permanently');
    expect(root.querySelector('.subscription-row')?.textContent).toContain('Your Pro membership');
    (root.querySelector('.subscription-row') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/subscription']);
  });
});
