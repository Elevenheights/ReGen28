import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { finalize } from 'rxjs/operators';
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

  features = [
    { icon: 'sparkles', title: 'Unlimited AI Guidance', description: 'Get daily personalized wellness insights' },
    { icon: 'camera', title: 'High-Fidelity AI Images', description: 'See yourself in your wellness goals' },
    { icon: 'analytics', title: 'Pro Analytics', description: 'Deep correlation between mood and activity' },
    { icon: 'notifications', title: 'Custom Ritual Reminders', description: 'Never miss a session with smart alerts' }
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
      .pipe(finalize(() => this.loading = false))
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
