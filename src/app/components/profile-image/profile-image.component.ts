import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img 
      [src]="currentImageUrl" 
      [alt]="alt"
      [class]="imageClasses"
      (error)="onImageError($event)"
      (load)="onImageLoad($event)"
      [style.display]="isLoading ? 'none' : 'block'"
    >
    
    <!-- Loading placeholder -->
    <div 
      *ngIf="isLoading"
      [class]="placeholderClasses"
    >
      <i class="fa-solid fa-user text-neutral-400"></i>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .loading-placeholder {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `]
})
export class ProfileImageComponent implements OnInit, OnChanges {
  @Input() photoURL: string = '';
  @Input() displayName: string = 'User';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() alt: string = 'Profile picture';
  
  currentImageUrl: string = '';
  isLoading: boolean = true;
  hasError: boolean = false;
  
  ngOnInit() {
    this.loadImage();
  }
  
  ngOnChanges() {
    this.loadImage();
  }
  
  private loadImage() {
    this.isLoading = true;
    this.hasError = false;
    
    if (this.photoURL) {
      // Try to use the provided photo URL
      this.currentImageUrl = this.optimizeGooglePhotoURL(this.photoURL);
    } else {
      // Use fallback avatar
      this.currentImageUrl = this.getFallbackURL();
    }
  }
  
  private optimizeGooglePhotoURL(url: string): string {
    if (url.includes('googleusercontent.com')) {
      // Optimize Google photo URLs for better loading
      return url.replace(/s\d+-c/, 's128-c');
    }
    return url;
  }
  
  private getFallbackURL(): string {
    const seed = this.displayName || 'user';
    return `https://api.dicebear.com/7.x/notionists/svg?scale=200&seed=${encodeURIComponent(seed)}`;
  }
  
  onImageError(event: any) {
    console.log('🖼️ Profile image failed to load, using fallback');
    this.hasError = true;
    this.isLoading = false;
    
    // Switch to fallback avatar
    const img = event.target as HTMLImageElement;
    img.src = this.getFallbackURL();
  }
  
  onImageLoad(event: any) {
    console.log('✅ Profile image loaded successfully');
    this.isLoading = false;
    this.hasError = false;
  }
  
  get imageClasses(): string {
    const baseClasses = 'object-cover shadow-lg rounded-2xl transition-all duration-200';
    const sizeClasses = {
      sm: 'w-8 h-8',      // 32px
      md: 'w-12 h-12',    // 48px  
      lg: 'w-14 h-14',    // 56px
      xl: 'w-20 h-20'     // 80px
    };
    
    return `${baseClasses} ${sizeClasses[this.size]}`;
  }
  
  get placeholderClasses(): string {
    const baseClasses = 'loading-placeholder rounded-2xl shadow-lg';
    const sizeClasses = {
      sm: 'w-8 h-8',      
      md: 'w-12 h-12',    
      lg: 'w-14 h-14',    
      xl: 'w-20 h-20'     
    };
    
    return `${baseClasses} ${sizeClasses[this.size]}`;
  }
} 