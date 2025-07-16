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
    {
      title: 'Mind & Focus',
      subtitle: 'Mental Wellness',
      description: 'Track meditation, mindfulness practices, and mental clarity. Build focus and reduce stress with guided sessions.',
      image: 'assets/intro/mind-focus.jpg',
      color: '#8b5cf6'
    },
    {
      title: 'Body & Health',
      subtitle: 'Physical Wellness',
      description: 'Monitor exercise, sleep quality, nutrition, and energy levels. Take control of your physical well-being.',
      image: 'assets/intro/body-health.jpg',
      color: '#10b981'
    },
    {
      title: 'Soul & Spirit',
      subtitle: 'Spiritual Wellness',
      description: 'Cultivate gratitude, meaningful connections, and spiritual growth. Nourish your inner self.',
      image: 'assets/intro/soul-spirit.jpg',
      color: '#f59e0b'
    },
    {
      title: 'Beauty & Self-Care',
      subtitle: 'Personal Care',
      description: 'Celebrate self-care routines, skincare practices, and personal confidence. You deserve to feel radiant.',
      image: 'assets/intro/beauty-selfcare.jpg',
      color: '#ec4899'
    },
    {
      title: '28-Day Journey',
      subtitle: 'Your Transformation',
      description: 'Track your progress, earn achievements, and celebrate milestones on your wellness transformation journey.',
      image: 'assets/intro/journey-progress.jpg',
      color: '#3b82f6'
    }
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