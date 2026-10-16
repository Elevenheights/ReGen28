import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionPage } from './subscription.page';
import { provideRouter } from '@angular/router';
import { NavController } from '@ionic/angular';
import { of } from 'rxjs';
import { SubscriptionService } from '../../services/subscription.service';

describe('SubscriptionPage', () => {
  let component: SubscriptionPage;
  let fixture: ComponentFixture<SubscriptionPage>;
  let billing: jasmine.SpyObj<SubscriptionService>;
  let navigation: jasmine.SpyObj<NavController>;

  beforeEach(async () => {
    billing = jasmine.createSpyObj('SubscriptionService', [
      'isNativePlatform', 'getOfferings', 'getEligibleFreeTrial', 'purchasePackage', 'restorePurchases'
    ]);
    billing.isNativePlatform.and.returnValue(true);
    billing.getEligibleFreeTrial.and.resolveTo(null);
    billing.getOfferings.and.returnValue(of({ monthly: { product: { priceString: 'CA$24.99' } } } as any));
    billing.purchasePackage.and.resolveTo(true);
    billing.restorePurchases.and.resolveTo(true);
    navigation = jasmine.createSpyObj('NavController', ['navigateRoot', 'back']);
    await TestBed.configureTestingModule({
      imports: [SubscriptionPage],
      providers: [
        provideRouter([]),
        { provide: SubscriptionService, useValue: billing },
        { provide: NavController, useValue: navigation }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SubscriptionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the store-provided localized price', () => {
    expect(fixture.nativeElement.textContent).toContain('CA$24.99');
    expect(component.loading).toBeFalse();
  });

  it('explains eligible trial, renewal price, currency and cancellation before purchase', async () => {
    billing.getEligibleFreeTrial.and.resolveTo('1-week');
    billing.getOfferings.and.returnValue(of({ monthly: { product: { priceString: '$24.99', currencyCode: 'CAD' } } } as any));
    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1-week free trial');
    expect(text).toContain('No charge today');
    expect(text).toContain('$24.99 CAD per month');
    expect(text).toContain('24 hours before the trial ends');
    expect(text).toContain('Start 1-week free trial');
  });

  it('does not promise a trial when eligibility is not confirmed', () => {
    expect(fixture.nativeElement.textContent).not.toContain('No charge today');
    expect(fixture.nativeElement.textContent).toContain('Any eligible free trial');
  });

  it('disables purchase and restore controls on the web', () => {
    billing.isNativePlatform.and.returnValue(false);
    component.ngOnInit();
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.find(button => button.textContent?.trim() === 'Continue')?.disabled).toBeTrue();
    expect(buttons.find(button => button.textContent?.includes('Restore Purchases'))?.disabled).toBeTrue();
  });

  it('enters the app only after confirmed purchase access', async () => {
    await component.startTrial();
    expect(billing.purchasePackage).toHaveBeenCalledWith(component.offerings.monthly);
    expect(navigation.navigateRoot).toHaveBeenCalledWith('/tabs/dashboard');
    expect(component.purchasing).toBeFalse();
  });

  it('does not navigate when purchase access is unconfirmed', async () => {
    billing.purchasePackage.and.resolveTo(false);
    await component.startTrial();
    expect(navigation.navigateRoot).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('not confirmed');
  });

  it('handles purchase failure without leaving controls busy', async () => {
    billing.purchasePackage.and.rejectWith(new Error('Test purchase failure'));
    await component.startTrial();
    expect(component.purchasing).toBeFalse();
    expect(component.errorMessage).toContain('could not be confirmed');
    expect(navigation.navigateRoot).not.toHaveBeenCalled();
  });

  it('blocks duplicate purchase requests', async () => {
    component.purchasing = true;
    await component.startTrial();
    expect(billing.purchasePackage).not.toHaveBeenCalled();
  });

  it('restores access before navigating', async () => {
    await component.restore();
    expect(billing.restorePurchases).toHaveBeenCalled();
    expect(navigation.navigateRoot).toHaveBeenCalledWith('/tabs/dashboard');
    expect(component.purchasing).toBeFalse();
  });

  it('keeps the user on the page when restore finds no access', async () => {
    billing.restorePurchases.and.resolveTo(false);
    await component.restore();
    expect(navigation.navigateRoot).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('No active subscription');
  });
});
