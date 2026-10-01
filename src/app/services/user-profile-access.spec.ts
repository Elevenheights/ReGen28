import { firstValueFrom, of } from 'rxjs';
import { UserService } from './user.service';
import { User } from '../models/user.interface';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { Storage } from '@angular/fire/storage';
import { ErrorHandlingService } from './error-handling.service';
import { LoggingService } from './logging.service';

describe('User profile billing defaults', () => {
  let db: { getDocument: jasmine.Spy; createDocumentWithId: jasmine.Spy };
  let service: UserService;
  beforeEach(() => {
    db = { getDocument: jasmine.createSpy().and.returnValue(of(null)), createDocumentWithId: jasmine.createSpy().and.returnValue(of(undefined)) };
    service = new UserService(
      {} as Storage,
      { user$: of({ uid: 'owner' }), getCurrentUser: () => ({ uid: 'owner' }), setUserService: () => {} } as unknown as AuthService,
      db as unknown as DatabaseService,
      {} as ErrorHandlingService,
      {} as LoggingService
    );
  });
  it('missing profiles cannot fabricate active trial access', async () => {
    expect(await firstValueFrom(service.getCurrentUserProfile())).toBeNull();
  });
  it('preserves actual onboarding status', async () => {
    db.getDocument.and.returnValue(of({ id: 'owner', isOnboardingComplete: false }));
    expect((await firstValueFrom(service.getCurrentUserProfile()))?.isOnboardingComplete).toBeFalse();
  });
  it('creates the correct user document without accepting billing grants', async () => {
    await service.createUserProfile({ status: 'active', role: 'admin', subscriptionType: 'trial', trialEndsAt: new Date(), subscriptionExpiration: new Date() });
    const [collection, uid, profile] = db.createDocumentWithId.calls.mostRecent().args as [string, string, User];
    expect(collection).toBe('users');
    expect(uid).toBe('owner');
    expect(profile.status).toBe('inactive');
    expect(profile.role).toBe('user');
    expect(profile.subscriptionType).toBe('expired');
    expect(profile.trialEndsAt).toBeUndefined();
    expect(profile.subscriptionExpiration).toBeUndefined();
  });
});
