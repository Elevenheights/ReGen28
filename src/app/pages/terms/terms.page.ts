import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
    <ion-content [fullscreen]="true" class="ion-no-border">
      <div class="min-h-screen bg-slate-950 text-white font-inter">

        <!-- Header -->
        <div class="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm border-b border-white/[0.06] px-6 py-4 flex items-center gap-4">
          <button (click)="back()" class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.06] active:scale-95 transition-all">
            <ion-icon name="chevron-back" class="text-lg text-slate-300"></ion-icon>
          </button>
          <h1 class="text-lg font-bold font-outfit">Terms of Use</h1>
        </div>

        <div class="px-6 py-8 max-w-2xl mx-auto space-y-8 pb-16">

          <p class="text-slate-400 text-sm">Effective date: June 1, 2026</p>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">1. Acceptance of Terms</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              By downloading or using Regen28 ("the App"), you agree to be bound by these Terms of Use. If you do not agree, please do not use the App.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">2. Subscription & Billing</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Regen28 offers a monthly subscription ("Regen28 Pro"). Your app store displays the localized price and any eligible introductory offer before you confirm purchase. After any free trial, the subscription automatically renews at the price shown by your app store unless cancelled at least 24 hours before the trial or current subscription period ends.
            </p>
            <p class="text-slate-400 text-sm leading-relaxed">
              Payment is charged to your Apple ID account at confirmation of purchase. Your subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. You can manage and cancel your subscription in your Apple ID account settings.
            </p>
            <p class="text-slate-400 text-sm leading-relaxed">
              No refunds are provided for partial subscription periods, except as required by applicable law.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">3. Use of the App</h2>
            <p class="text-slate-400 text-sm leading-relaxed">You agree to use Regen28 only for lawful purposes. You may not:</p>
            <ul class="text-slate-400 text-sm leading-relaxed space-y-1 list-disc list-inside">
              <li>Share, transfer, or sell access to your account</li>
              <li>Attempt to reverse engineer or extract the source code</li>
              <li>Use the app for any commercial purpose without our written consent</li>
              <li>Upload content that is unlawful, abusive, or infringes on third-party rights</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">4. AI-Generated Content</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Regen28 uses AI to generate personalized coaching content, insights, and images. This content is for informational and motivational purposes only and does not constitute medical, psychological, or professional health advice. Always consult a qualified health professional before making decisions about your health.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">5. User Content</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              You retain ownership of content you create in the app (journal entries, tracker data, photos). By uploading content, you grant us a limited license to process and display it within the app to provide the service.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">6. Account Termination</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              We reserve the right to suspend or terminate your account for violations of these Terms. You may delete your account at any time from within the app.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">7. Disclaimer of Warranties</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Regen28 is provided "as is" without warranties of any kind. We do not guarantee that the app will be error-free, uninterrupted, or that results from using the app will meet your expectations.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">8. Limitation of Liability</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              To the maximum extent permitted by law, Eleven Heights LLC and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">9. Governing Law</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              These Terms are governed by the laws of the State of Florida, United States, without regard to conflict of law principles.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">10. Changes to Terms</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              We may update these Terms at any time. Continued use of the app after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">11. Contact</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Questions about these Terms? Contact us at:
              <br/><span class="text-indigo-400">support&#64;regen28.com</span>
            </p>
          </section>

        </div>
      </div>
    </ion-content>
  `
})
export class TermsPage {
  constructor(private navCtrl: NavController) {}

  back() {
    this.navCtrl.back();
  }
}
