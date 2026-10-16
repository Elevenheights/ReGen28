import { firstValueFrom, of } from 'rxjs';
import { Platform } from '@ionic/angular';
import { Purchases, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { SubscriptionService } from './subscription.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DatabaseService } from './database.service';
import { LoggingService } from './logging.service';
import { environment } from '../../environments/environment';

describe('SubscriptionService', () => {
  let native: boolean;
  let android: boolean;
  let originalAndroidKey: string;
  let purchases: jasmine.SpyObj<typeof Purchases>;
  let db: { callFunction: jasmine.Spy };
  const customerInfo = { entitlements: { active: { 'Regen28 Pro': {} } } } as unknown as CustomerInfo;

  beforeEach(() => {
    native = true;
    android = false;
    originalAndroidKey = environment.revenueCat.androidApiKey;
    db = { callFunction: jasmine.createSpy().and.returnValue(of({ active: true })) };
    purchases = jasmine.createSpyObj('Purchases', ['setLogLevel', 'configure', 'addCustomerInfoUpdateListener', 'isAnonymous', 'getOfferings', 'logIn', 'purchasePackage', 'restorePurchases', 'checkTrialOrIntroductoryPriceEligibility']);
    purchases.setLogLevel.and.resolveTo();
    purchases.configure.and.resolveTo();
    purchases.addCustomerInfoUpdateListener.and.resolveTo('listener');
    purchases.isAnonymous.and.resolveTo({ isAnonymous: true });
    purchases.getOfferings.and.resolveTo({ current: null, all: {} });
    purchases.logIn.and.resolveTo({ customerInfo, created: false });
    purchases.purchasePackage.and.resolveTo({ customerInfo } as Awaited<ReturnType<typeof Purchases.purchasePackage>>);
    purchases.restorePurchases.and.resolveTo({ customerInfo });
  });
  afterEach(() => { environment.revenueCat.androidApiKey = originalAndroidKey; });

  function service(ready: Promise<string> = Promise.resolve('ready')): SubscriptionService {
    return new SubscriptionService(
      { ready: () => ready, is: (name: string) => name === 'capacitor' ? native : name === 'android' && android } as unknown as Platform,
      { user$: of(null), getCurrentUser: () => ({ uid: 'owner' }) } as unknown as AuthService,
      { getCurrentUserProfile: () => of(null) } as unknown as UserService,
      db as unknown as DatabaseService,
      { warn: () => {}, error: () => {} } as unknown as LoggingService,
      purchases
    );
  }

  it('uses the iOS SDK key on iOS', async () => {
    await firstValueFrom(service().getOfferings());
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: environment.revenueCat.iosApiKey });
  });

  const trialProduct = { identifier: 'monthly', introPrice: { price: 0, cycles: 1, periodUnit: 'WEEK', periodNumberOfUnits: 1 } } as any;
  it('returns the store trial duration only for eligible customers', async () => {
    purchases.checkTrialOrIntroductoryPriceEligibility.and.resolveTo({ monthly: { status: 2 } } as any);
    expect(await service().getEligibleFreeTrial(trialProduct)).toBe('1-week');
  });
  it('does not promise a trial for ineligible or unknown eligibility', async () => {
    for (const status of [0, 1, 3]) {
      purchases.checkTrialOrIntroductoryPriceEligibility.and.resolveTo({ monthly: { status } } as any);
      expect(await service().getEligibleFreeTrial(trialProduct)).toBeNull();
    }
  });
  it('falls back safely when eligibility fails or the introduction is paid', async () => {
    purchases.checkTrialOrIntroductoryPriceEligibility.and.rejectWith(new Error('offline'));
    expect(await service().getEligibleFreeTrial(trialProduct)).toBeNull();
    expect(await service().getEligibleFreeTrial({ ...trialProduct, introPrice: { ...trialProduct.introPrice, price: 1 } })).toBeNull();
  });
  it('uses the Google Play SDK key on Android', async () => {
    android = true;
    environment.revenueCat.androidApiKey = 'goog_test';
    await firstValueFrom(service().getOfferings());
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'goog_test' });
  });
  it('never falls back to the iOS key when Android billing is missing', async () => {
    android = true;
    environment.revenueCat.androidApiKey = '';
    expect(await firstValueFrom(service().getOfferings())).toBeNull();
    expect(purchases.configure).not.toHaveBeenCalled();
    expect(purchases.getOfferings).not.toHaveBeenCalled();
  });
  it('waits for platform readiness before requesting offers', async () => {
    let release!: (value: string) => void;
    const ready = new Promise<string>(resolve => { release = resolve; });
    const offering = firstValueFrom(service(ready).getOfferings());
    expect(purchases.getOfferings).not.toHaveBeenCalled();
    release('ready');
    await offering;
    expect(purchases.getOfferings).toHaveBeenCalled();
  });
  it('identifies the signed-in user and verifies purchase access on the server', async () => {
    expect(await service().purchasePackage({} as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'])).toBeTrue();
    expect(purchases.logIn).toHaveBeenCalledWith({ appUserID: 'owner' });
    expect(db.callFunction).toHaveBeenCalledWith('updateUserSubscriptionStatus', {});
  });
  it('does not grant access when the server rejects an SDK entitlement', async () => {
    db.callFunction.and.returnValue(of({ active: false }));
    expect(await service().purchasePackage({} as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'])).toBeFalse();
  });
  it('restore verifies access before navigating back into the app', async () => {
    expect(await service().restorePurchases()).toBeTrue();
    expect(db.callFunction).toHaveBeenCalledWith('updateUserSubscriptionStatus', {});
  });
  it('web never initializes native billing', async () => {
    native = false;
    expect(await firstValueFrom(service().getOfferings())).toBeNull();
    expect(purchases.configure).not.toHaveBeenCalled();
  });
});
