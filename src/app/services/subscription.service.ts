import { Injectable, Inject, InjectionToken } from '@angular/core';
import { Purchases, CustomerInfo, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import { BehaviorSubject, Observable, from, of, map, catchError, firstValueFrom, switchMap, distinctUntilChanged } from 'rxjs';
import { Platform } from '@ionic/angular';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { DatabaseService } from './database.service';
import { LoggingService } from './logging.service';
import { environment } from '../../environments/environment';

export const PURCHASES_CLIENT = new InjectionToken<typeof Purchases>('RevenueCat purchases client', {
	providedIn: 'root', factory: () => Purchases
});

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
	private readonly isProSubject = new BehaviorSubject<boolean>(false);
	public readonly isPro$ = this.isProSubject.asObservable();
	private readonly entitlementId = 'Regen28 Pro';
	private readonly ready: Promise<boolean>;

	constructor(
		private platform: Platform,
		private authService: AuthService,
		private userService: UserService,
		private db: DatabaseService,
		private logging: LoggingService,
		@Inject(PURCHASES_CLIENT) private purchases: typeof Purchases = Purchases
	) {
		this.ready = this.initialize();
	}

	private async initialize(): Promise<boolean> {
		await this.platform.ready();
		if (!this.isNativePlatform()) {
			this.authService.user$.pipe(
				switchMap(user => user ? this.userService.getCurrentUserProfile() : of(null))
			).subscribe(profile => this.isProSubject.next(profile?.status === 'active'));
			return false;
		}
		const android = this.platform.is('android');
		const apiKey = android ? environment.revenueCat.androidApiKey : environment.revenueCat.iosApiKey;
		if (!apiKey.startsWith(android ? 'goog_' : 'appl_')) {
			this.logging.error('Billing is not configured for this platform');
			return false;
		}
		try {
			await this.purchases.setLogLevel({ level: environment.production ? LOG_LEVEL.WARN : LOG_LEVEL.DEBUG });
			await this.purchases.configure({ apiKey });
			await this.purchases.addCustomerInfoUpdateListener(info => {
				// Local display state only; the server controls billing access.
				this.isProSubject.next(!!info.entitlements.active[this.entitlementId]);
			});
			this.authService.user$.pipe(
				map(user => user?.uid ?? null), distinctUntilChanged()
			).subscribe(uid => {
				if (uid) {
					void this.refreshCustomerInfo();
				} else {
					this.isProSubject.next(false);
					void this.purchases.isAnonymous().then(({ isAnonymous }) => {
						if (!isAnonymous && !this.authService.getCurrentUser()) return this.purchases.logOut();
						return undefined;
					}).catch(error => this.logging.warn('Billing logout failed', error));
				}
			});
			return true;
		} catch (error) {
			this.logging.error('Billing initialization failed', error);
			return false;
		}
	}

	private async requireReady(): Promise<void> {
		if (!await this.ready) throw new Error('Billing is unavailable. Please try again later.');
	}

	private async identifyCurrentUser(): Promise<string> {
		await this.requireReady();
		const user = this.authService.getCurrentUser();
		if (!user) throw new Error('Sign in before managing your subscription.');
		await this.purchases.logIn({ appUserID: user.uid });
		return user.uid;
	}

	private async syncVerifiedAccess(uid: string, info: CustomerInfo): Promise<boolean> {
		if (this.authService.getCurrentUser()?.uid !== uid) return false;
		const result = await firstValueFrom(this.db.callFunction<Record<string, never>, { active: boolean }>(
			'updateUserSubscriptionStatus', {}
		));
		if (this.authService.getCurrentUser()?.uid !== uid) return false;
		this.isProSubject.next(result.active);
		return result.active && !!info.entitlements.active[this.entitlementId];
	}

	public async refreshCustomerInfo(): Promise<void> {
		if (!this.isNativePlatform()) return;
		try {
			const uid = await this.identifyCurrentUser();
			const { customerInfo } = await this.purchases.getCustomerInfo();
			await this.syncVerifiedAccess(uid, customerInfo);
		} catch (error) {
			this.logging.warn('Could not refresh subscription', error);
		}
	}

	public isNativePlatform(): boolean { return this.platform.is('capacitor'); }

	public async presentPaywall(): Promise<boolean> {
		const uid = await this.identifyCurrentUser();
		const { result } = await RevenueCatUI.presentPaywall();
		if (result !== PAYWALL_RESULT.PURCHASED && result !== PAYWALL_RESULT.RESTORED) return false;
		const { customerInfo } = await this.purchases.getCustomerInfo();
		return this.syncVerifiedAccess(uid, customerInfo);
	}

	public async restorePurchases(): Promise<boolean> {
		const uid = await this.identifyCurrentUser();
		const { customerInfo } = await this.purchases.restorePurchases();
		return this.syncVerifiedAccess(uid, customerInfo);
	}

	public async purchasePackage(aPackage: Parameters<typeof Purchases.purchasePackage>[0]['aPackage']): Promise<boolean> {
		const uid = await this.identifyCurrentUser();
		const { customerInfo } = await this.purchases.purchasePackage({ aPackage });
		return this.syncVerifiedAccess(uid, customerInfo);
	}

	public getOfferings(): Observable<any> {
		if (!this.isNativePlatform()) return of(null);
		return from(this.requireReady()).pipe(
			switchMap(() => from(this.purchases.getOfferings())),
			map(offerings => offerings.current),
			catchError(error => {
				this.logging.warn('Subscription offers could not be loaded', error);
				return of(null);
			})
		);
	}
}
