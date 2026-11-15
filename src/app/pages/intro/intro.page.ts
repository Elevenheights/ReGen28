import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  rocket,
  chevronBack,
  chevronForward
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { take, firstValueFrom } from 'rxjs';

interface FeatureSlide {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  color: string;
}

@Component({
  selector: 'app-intro',
  templateUrl: './intro.page.html',
  styleUrls: ['./intro.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    IonContent,
    IonButton,
    IonIcon
  ]
})
export class IntroPage implements OnInit {
  currentSlide = 0;

  // Touch/swipe handling
  private startX = 0;
  private startY = 0;

  featureSlides: FeatureSlide[] = [
    { title: 'Find your rhythm.', subtitle: 'Your 28-day journey', description: 'Explore your daily habits with trackers, reflections, and a private timeline made around you.', image: 'assets/images/indigo-muse/morning-light.webp', color: '#17132b' },
    { title: 'Small actions. Your way.', subtitle: 'Trackers that fit your life', description: 'Choose what matters. Set your targets. Log a little progress, one day at a time.', image: 'assets/images/indigo-muse/movement.webp', color: '#17132b' },
    { title: 'Your story, unfolding.', subtitle: 'Reflection meets progress', description: 'See what you’ve logged and reflect on your experience. Optional AI coaching offers ideas based on your activity.', image: 'assets/images/indigo-muse/reflection.webp', color: '#17132b' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {
    // Add icons to the registry
    addIcons({
      rocket,
      chevronBack,
      chevronForward
    });
  }

  async ngOnInit() {
    // Global navigation logic in AppComponent will handle authentication/onboarding redirects
  }

  nextSlide() {
    if (this.currentSlide < this.featureSlides.length - 1) {
      this.currentSlide++;
    }
  }

  prevSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  goToSlide(index: number) {
    this.currentSlide = index;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  isLastSlide(): boolean {
    return this.currentSlide === this.featureSlides.length - 1;
  }

  isFirstSlide(): boolean {
    return this.currentSlide === 0;
  }

  // Touch/Swipe event handlers
  onTouchStart(event: TouchEvent) {
    this.startX = event.touches[0].clientX;
    this.startY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    if (!this.startX || !this.startY) {
      return;
    }

    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;

    const deltaX = this.startX - endX;
    const deltaY = this.startY - endY;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Minimum swipe distance (50px)
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // Swipe left - next slide
          this.nextSlide();
        } else {
          // Swipe right - previous slide
          this.prevSlide();
        }
      }
    }

    // Reset
    this.startX = 0;
    this.startY = 0;
  }

  // Keyboard navigation
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      this.prevSlide();
    } else if (event.key === 'ArrowRight') {
      this.nextSlide();
    }
  }
}
