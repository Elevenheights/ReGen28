import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonButton } from '@ionic/angular/standalone';
import { firstValueFrom, take } from 'rxjs';
import { UserService } from '../../services/user.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonButton],
  template: `
    <ion-content>
      <main class="max-w-lg mx-auto p-6 pt-12 space-y-5">
        <h1 class="text-3xl font-bold">Your AI privacy choices</h1>
        <p>AI features are optional. With your permission, ReGen28 sends your wellness goals,
          focus areas, profile details (such as age and gender), location, habit and mood records,
          and journal context to <strong>OpenAI</strong> to generate coaching, recommendations, and insights.</p>
        <p>When you use AI visualizations, prompts and your selected reference/progress photos may
          be sent to <strong>OpenAI</strong> and <strong>Google Vertex AI (Gemini)</strong> for image generation.
          Photos are optional; do not upload photos you do not want processed by these providers.</p>
        <p>You can decline and keep using non-AI tracking and journaling. You can change this
          choice in Settings > AI data-sharing choices. Revoking consent stops new AI requests;
          it does not recall data already processed by providers.</p>
        <p>AI content can be inaccurate. ReGen28 provides general wellness information, not
          medical advice, diagnosis, or treatment.</p>
        <p><a routerLink="/privacy" class="text-indigo-600 underline">ReGen28 privacy policy</a> ·
          <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer" class="underline">OpenAI privacy</a> ·
          <a href="https://cloud.google.com/terms/cloud-privacy-notice" target="_blank" rel="noopener noreferrer" class="underline">Google Cloud privacy</a></p>
        <p *ngIf="error" role="alert" class="text-red-700">{{ error }}</p>
        <ion-button expand="block" [disabled]="saving" (click)="save(true)">Allow AI data sharing</ion-button>
        <ion-button expand="block" fill="outline" [disabled]="saving" (click)="save(false)">Continue without AI / revoke consent</ion-button>
        <a routerLink="/account" class="block text-center underline">Manage or delete my account</a>
      </main>
    </ion-content>`
})
export class AiConsentPage {
  saving = false;
  error = '';
  constructor(private userService: UserService, private router: Router) {}
  async save(allowed: boolean): Promise<void> {
    this.saving = true;
    this.error = '';
    try {
      await this.userService.updateUserProfile({ aiConsent: allowed, aiConsentVersion: 1 });
      const profile = await firstValueFrom(this.userService.getCurrentUserProfile().pipe(take(1)));
      await this.router.navigate([profile?.isOnboardingComplete ? '/tabs/dashboard' : '/onboarding/welcome']);
    } catch {
      this.error = 'Your choice could not be saved. Please try again.';
    } finally { this.saving = false; }
  }
}
