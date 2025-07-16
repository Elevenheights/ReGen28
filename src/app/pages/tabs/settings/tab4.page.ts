import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';

// Services
import { UserService } from '../../../services/user.service';
import { LoggingService } from '../../../services/logging.service';

// Models
import { User } from '../../../models/user.interface';

@Component({
  selector: 'app-tab4',
  templateUrl: './tab4.page.html',
  styleUrls: ['./tab4.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar,
    CommonModule, 
    FormsModule
  ]
})
export class Tab4Page implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // User data
  user: User | null = null;
  
  // Profile image
  profileImageUrl = 'https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=42';
  userDisplayName = 'User';

  constructor(
    private userService: UserService,
    private logging: LoggingService
  ) { }

  ngOnInit() {
    this.loadUserProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserProfile() {
    this.userService.getCurrentUserProfile().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user) => {
        this.user = user;
        this.updateProfileImageUrl();
      },
      error: (error) => {
        this.logging.error('Failed to load user profile', { error });
      }
    });
  }

  private updateProfileImageUrl() {
    if (this.user) {
      this.userDisplayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';
      
      // Use Dicebear avatar with user's name as seed for consistency
      this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
      
      // Use actual photo if available
      if (this.user.photoURL) {
        const photoURL = this.user.photoURL;
        this.profileImageUrl = photoURL;
      }
    }
  }

  onImageError(event: any) {
    // Fallback to Dicebear avatar if image fails to load
    this.logging.debug('Profile image failed to load, using fallback');
    this.profileImageUrl = `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${this.userDisplayName}`;
  }

  onImageLoad(event: any) {
    this.logging.debug('Profile image loaded successfully');
  }

  getProfileImageUrl(): string {
    return this.profileImageUrl;
  }
}
