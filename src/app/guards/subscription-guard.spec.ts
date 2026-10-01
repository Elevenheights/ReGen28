import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of, throwError, firstValueFrom, Observable } from 'rxjs';
import { SubscriptionGuard } from './subscription.guard';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let auth: { user$: Observable<{ uid: string } | null> };
  let users: { getCurrentUserProfile: jasmine.Spy };
  let router: Router;

  beforeEach(() => {
    auth = { user$: of({ uid: 'test-user' }) };
    users = { getCurrentUserProfile: jasmine.createSpy().and.returnValue(of({ status: 'inactive' })) };
    TestBed.configureTestingModule({ providers: [
      SubscriptionGuard,
      { provide: AuthService, useValue: auth },
      { provide: UserService, useValue: users }
    ] });
    guard = TestBed.inject(SubscriptionGuard);
    router = TestBed.inject(Router);
  });

  async function destination(): Promise<string | boolean> {
    const result = await firstValueFrom(guard.canActivate());
    return result instanceof UrlTree ? router.serializeUrl(result) : result;
  }

  it('requires authentication', async () => {
    auth.user$ = of(null);
    expect(await destination()).toBe('/login');
    expect(users.getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('allows active subscriptions', async () => {
    users.getCurrentUserProfile.and.returnValue(of({ status: 'active', subscriptionExpiration: new Date(Date.now() + 60000) }));
    expect(await destination()).toBeTrue();
  });

  it('blocks inactive and suspended accounts', async () => {
    for (const status of ['inactive', 'suspended']) {
      users.getCurrentUserProfile.and.returnValue(of({ status }));
      expect(await destination()).toBe('/subscription');
    }
  });

  it('blocks expired subscriptions before daily maintenance runs', async () => {
    users.getCurrentUserProfile.and.returnValue(of({ status: 'active', subscriptionExpiration: new Date(Date.now() - 60000) }));
    expect(await destination()).toBe('/subscription');
  });

  it('handles Firestore timestamp expirations', async () => {
    users.getCurrentUserProfile.and.returnValue(of({ status: 'active', trialEndsAt: { toDate: () => new Date(Date.now() - 60000) } }));
    expect(await destination()).toBe('/subscription');
  });

  it('requires an existing profile', async () => {
    users.getCurrentUserProfile.and.returnValue(of(null));
    expect(await destination()).toBe('/login');
  });

  it('does not grant access when profile lookup fails', async () => {
    users.getCurrentUserProfile.and.returnValue(throwError(() => new Error('offline')));
    expect(await destination()).toBe('/subscription');
  });
});
