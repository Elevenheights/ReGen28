import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
	selector: 'app-breathe-modal',
	template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="bg-transparent">
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()" color="light">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="breathe-content" [fullscreen]="true">
      <div class="flex flex-col items-center justify-center h-full relative z-10">
        <h2 class="text-3xl font-bold text-white mb-8 tracking-wide drop-shadow-md">{{ currentPhase }}</h2>
        
        <div class="breath-circle-container relative mb-12">
          <!-- Outer glow rings -->
          <div class="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse-slow"></div>
          <div class="absolute inset-0 rounded-full bg-blue-400/30 blur-2xl animate-pulse-slower"></div>
          
          <!-- Breathing circle -->
          <div class="breath-circle w-64 h-64 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shadow-2xl flex items-center justify-center relative overflow-hidden transition-all duration-1000 ease-in-out"
               [ngClass]="{'scale-100': phase === 'inhale', 'scale-110': phase === 'hold', 'scale-75': phase === 'exhale'}">
            
            <div class="absolute inset-0 bg-white/20 rounded-full scale-0 transition-transform duration-[4000ms] ease-out"
                 [ngClass]="{'scale-100': phase === 'inhale', 'scale-110': phase === 'hold'}"></div>
            
            <ion-icon name="fitness" class="text-6xl text-white opacity-80"></ion-icon>
          </div>
          
          <!-- Timer text inside/below -->
          <div class="absolute -bottom-16 left-0 right-0 text-center">
            <p class="text-white/80 text-lg font-medium">{{ feedbackText }}</p>
          </div>
        </div>

        <p class="text-white/60 text-sm max-w-xs text-center px-4 leading-relaxed">
          Focus on your breath. Inhale deeply, hold a moment, and release slowly.
        </p>
      </div>

      <!-- Background Gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 z-0"></div>
    </ion-content>
  `,
	styles: [`
    .breathe-content {
      --background: transparent;
    }
    .animate-pulse-slow {
      animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .animate-pulse-slower {
      animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .breath-circle {
      transition: transform 4s ease-in-out;
    }
    .scale-100 { transform: scale(1); } /* Inhale start / Hold */
    .scale-125 { transform: scale(1.25); } /* Full inhale */
    .scale-75 { transform: scale(0.75); } /* Exhale */
  `],
	standalone: true,
	imports: [CommonModule, IonicModule]
})
export class BreatheModalComponent implements OnInit, OnDestroy {
	phase: 'inhale' | 'hold' | 'exhale' = 'inhale';
	currentPhase = 'Inhale';
	feedbackText = 'Breathe in...';
	private timer: any;
	private interval: any;

	constructor(private modalCtrl: ModalController) { }

	ngOnInit() {
		this.startBreathingCycle();
	}

	ngOnDestroy() {
		clearTimeout(this.timer);
		clearInterval(this.interval);
	}

	startBreathingCycle() {
		this.runCycle();
		this.interval = setInterval(() => {
			this.runCycle();
		}, 19000); // 4+7+8 = 19s total cycle
	}

	runCycle() {
		// 4-7-8 Breathing Technique

		// Inhale (4s)
		this.setPhase('inhale', 'Inhale', 'Breathe in deeply through your nose', 4000);

		this.timer = setTimeout(() => {
			// Hold (7s)
			this.setPhase('hold', 'Hold', 'Hold your breath', 7000);

			this.timer = setTimeout(() => {
				// Exhale (8s)
				this.setPhase('exhale', 'Exhale', 'Exhale completely through your mouth', 8000);
			}, 7000);
		}, 4000);
	}

	setPhase(phase: 'inhale' | 'hold' | 'exhale', text: string, feedback: string, duration: number) {
		this.phase = phase;
		this.currentPhase = text;
		this.feedbackText = feedback;
	}

	dismiss() {
		this.modalCtrl.dismiss();
	}
}
