import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';

@Component({
  selector: 'app-privacy',
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
          <h1 class="text-lg font-bold font-outfit">Privacy Policy</h1>
        </div>

        <div class="px-6 py-8 max-w-2xl mx-auto space-y-8 pb-16">

          <p class="text-slate-400 text-sm">Effective date: June 1, 2026</p>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">1. Information We Collect</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              We collect information you provide directly, including your name, email address, date of birth, and wellness preferences during account creation and onboarding. We also collect data you log within the app — tracker entries, journal entries, mood logs, goals, and activity records.
            </p>
            <p class="text-slate-400 text-sm leading-relaxed">
              If you choose to upload reference photos for personalized AI image generation, those images are stored securely and used solely for that feature.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">2. How We Use Your Information</h2>
            <p class="text-slate-400 text-sm leading-relaxed">We use your information to:</p>
            <ul class="text-slate-400 text-sm leading-relaxed space-y-1 list-disc list-inside">
              <li>Provide personalized AI coaching, insights, and wellness recommendations</li>
              <li>Generate your daily feed content, statistics, and progress reports</li>
              <li>Send push notifications for ritual reminders and coaching updates</li>
              <li>Process your subscription through the App Store</li>
              <li>Improve the app experience and fix issues</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">3. Data Storage & Security</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Your data is stored securely using Google Firebase (Firestore and Firebase Storage), protected by industry-standard encryption in transit and at rest. We do not sell your personal data to third parties.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">4. Third-Party Services</h2>
            <p class="text-slate-400 text-sm leading-relaxed">We use the following third-party services to operate the app:</p>
            <ul class="text-slate-400 text-sm leading-relaxed space-y-1 list-disc list-inside">
              <li><strong class="text-slate-300">Firebase (Google)</strong> — Authentication, database, and storage</li>
              <li><strong class="text-slate-300">RevenueCat</strong> — Subscription management and billing</li>
              <li><strong class="text-slate-300">OpenAI</strong> — AI text and image generation</li>
              <li><strong class="text-slate-300">Google Gemini</strong> — AI image generation</li>
            </ul>
            <p class="text-slate-400 text-sm leading-relaxed">
              Each service has its own privacy policy governing how they handle data.
              AI processing is optional and requires your explicit permission on the AI data-sharing screen.
              With permission, OpenAI processes your goals, profile details, wellness records, location, and journal context for coaching.
              OpenAI and Google Vertex AI (Gemini) may process selected reference/progress photos and prompts for visualizations.
              You can decline or revoke permission in Settings > AI data-sharing choices; this stops new requests, not prior processing.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">5. Subscription & Billing</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Payments are processed entirely by Apple through the App Store. We do not have access to your payment card details. Subscription management, cancellation, and refunds are handled through your Apple ID account settings.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">6. Push Notifications</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              We send push notifications for ritual reminders and coaching content. You can disable these at any time in your device Settings or within the app's notification preferences.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">7. Children's Privacy</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Regen28 is not directed at children under the age of 13. We do not knowingly collect personal data from children under 13.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">8. Your Rights</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              You can initiate permanent account deletion in Settings > Delete account permanently, or from Manage account on the subscription screen.
              This removes your Firebase account, wellness records, journal entries, and uploaded/generated images.
              Sign in again immediately before deletion for security. App Store subscription cancellation is separate: cancel in Apple Settings > Subscriptions.
              Apple and billing providers may retain transaction records under their own retention obligations.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">9. Changes to This Policy</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice in the app.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-bold text-white">10. Contact Us</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
              <br/><span class="text-indigo-400">support&#64;regen28.com</span>
            </p>
          </section>

        </div>
      </div>
    </ion-content>
  `
})
export class PrivacyPage {
  constructor(private navCtrl: NavController) {}

  back() {
    this.navCtrl.back();
  }
}
