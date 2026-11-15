import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { finalize, switchMap } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { sparkles, camera, analytics, notifications } from 'ionicons/icons';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.page.html',
  styleUrls: ['./subscription.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterLink]
})
export class SubscriptionPage implements OnInit {
  offerings: any = null;
  loading = true;
  purchasing = false;
  isWeb = false;
  errorMessage = '';
  freeTrial: string | null = null;

  features = [
    { icon: 'sparkles', title: 'Optional AI coaching', description: 'Guidance ideas based on your logged activity' },
    { icon: 'camera', title: 'Personalized AI visuals', description: 'Optional creative images, with your consent' },
    { icon: 'analytics', title: 'Your progress, together', description: 'Review tracker entries and journal reflections' },
    { icon: 'notifications', title: 'Tracker reminders', description: 'Choose reminders that fit your schedule' }
  ];

  constructor(
    private subscriptionService: SubscriptionService,
    private navCtrl: NavController
  ) {
    addIcons({ sparkles, camera, analytics, notifications });
  }

  ngOnInit() {
    this.isWeb = !this.subscriptionService.isNativePlatform();

    this.subscriptionService.getOfferings()
      .pipe(
        switchMap(async offering => {
          this.freeTrial = offering?.monthly?.product
            ? await this.subscriptionService.getEligibleFreeTrial(offering.monthly.product) : null;
          return offering;
        }),
        finalize(() => this.loading = false)
      )
      .subscribe(offering => {
        this.offerings = offering;
      });
  }

  async startTrial() {
    if (!this.offerings?.monthly || this.purchasing) return;

    this.purchasing = true;
    this.errorMessage = '';
    try {
      // Use the Custom UI flow bypassing the RevenueCat overlay
      const success = await this.subscriptionService.purchasePackage(this.offerings.monthly);
      if (success) {
        this.navCtrl.navigateRoot('/tabs/dashboard');
      } else {
        this.errorMessage = 'Access is not confirmed yet. Please try Restore Purchases.';
      }
    } catch (error) {
      this.errorMessage = 'Purchase could not be confirmed. If you completed payment, try Restore Purchases.';
    } finally {
      this.purchasing = false;
    }
  }


  async restore() {
    if (this.purchasing || this.isWeb) return;
    this.purchasing = true;
    this.errorMessage = '';
    try {
      const active = await this.subscriptionService.restorePurchases();
      if (active) await this.navCtrl.navigateRoot('/tabs/dashboard');
      else this.errorMessage = 'No active subscription was found for this account.';
    } catch (error) {
      this.errorMessage = 'Purchases could not be restored. Please try again.';
    } finally {
      this.purchasing = false;
    }
  }

  close() {
    this.navCtrl.back();
  }
}
