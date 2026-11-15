import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-breathe-modal',
  templateUrl: './breathe-modal.component.html',
  styleUrls: ['./breathe-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class BreatheModalComponent implements OnInit, OnDestroy {
  phase: 'inhale' | 'hold' | 'exhale' = 'inhale';
  currentPhase = 'Inhale';
  feedbackText = 'Breathe in...';
  private timer: any;
  private interval: any;

  constructor(private modalCtrl: ModalController) {}

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
    this.setPhase(
      'inhale',
      'Inhale',
      'Breathe in deeply through your nose',
      4000,
    );

    this.timer = setTimeout(() => {
      // Hold (7s)
      this.setPhase('hold', 'Hold', 'Hold your breath', 7000);

      this.timer = setTimeout(() => {
        // Exhale (8s)
        this.setPhase(
          'exhale',
          'Exhale',
          'Exhale completely through your mouth',
          8000,
        );
      }, 7000);
    }, 4000);
  }

  setPhase(
    phase: 'inhale' | 'hold' | 'exhale',
    text: string,
    feedback: string,
    duration: number,
  ) {
    this.phase = phase;
    this.currentPhase = text;
    this.feedbackText = feedback;
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
