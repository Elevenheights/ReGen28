import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, Platform } from '@ionic/angular';
import { 
  IonContent, IonCard, IonCardContent, 
  IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption,
  IonProgressBar, IonText, IonAvatar, IonImg, IonToggle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { person, time, camera, checkmark, arrowForward, arrowBack, people, calendar } from 'ionicons/icons';
import { Device } from '@capacitor/device';

import { OnboardingService } from '../../../services/onboarding.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonCard, IonCardContent,
    IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption,
    IonProgressBar, IonText, IonAvatar, IonImg, IonToggle
  ]
})
export class ProfilePage implements OnInit {
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;
  
  profileForm: FormGroup;
  currentUser: any;
  showCustomTime = false;
  selectedPhotoUrl: string | null = null;
  photoLoadError = false;
  isNativePlatform = false;
  
  // Date constraints for birthday
  maxBirthday: string;
  minBirthday: string;
  
  reminderTimes = [
    { value: '06:00', label: '6:00 AM - Early Bird' },
    { value: '07:00', label: '7:00 AM - Morning Start' },
    { value: '08:00', label: '8:00 AM - Work Ready' },
    { value: '09:00', label: '9:00 AM - Mid-Morning' },
    { value: '12:00', label: '12:00 PM - Lunch Break' },
    { value: '18:00', label: '6:00 PM - Evening Wind Down' },
    { value: '20:00', label: '8:00 PM - Night Reflection' },
    { value: '21:00', label: '9:00 PM - Before Bed' },
    { value: 'custom', label: 'Custom Time' }
  ];

  genderOptions = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'non-binary', label: 'Non-binary' },
    { value: 'prefer-not-to-say', label: 'Prefer not to say' },
    { value: 'other', label: 'Other' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private onboardingService: OnboardingService,
    private authService: AuthService,
    private toastController: ToastController,
    private platform: Platform
  ) {
    addIcons({ person, time, camera, checkmark, arrowForward, arrowBack, people, calendar });
    
    // Set birthday constraints (13-120 years old)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
    
    this.maxBirthday = maxDate.toISOString();
    this.minBirthday = minDate.toISOString();
    
    this.profileForm = this.formBuilder.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      gender: ['', Validators.required],
      birthday: ['', Validators.required],
      reminderTime: ['09:00', Validators.required],
      customTime: ['09:00'],
      notifications: [true]
    });
  }

  async ngOnInit() {
    // Check if we're on a native platform
    const deviceInfo = await Device.getInfo();
    this.isNativePlatform = this.platform.is('capacitor') && (this.platform.is('ios') || this.platform.is('android'));
    
    this.currentUser = this.authService.getCurrentUser();
    
    // Auto-detect user's timezone
    const detectedTimezone = this.detectUserTimezone();
    console.log('🌍 Auto-detected timezone:', detectedTimezone);
    
    // Pre-populate with existing data
    const onboardingData = this.onboardingService.getCurrentData();
    
    // Always use first name from Google if available, otherwise use saved data
    let displayName = '';
    if (this.currentUser?.displayName) {
      // Extract just the first name from the full display name
      displayName = this.currentUser.displayName.split(' ')[0];
    } else if (onboardingData.profileData.displayName) {
      displayName = onboardingData.profileData.displayName;
    }
    
    if (onboardingData.profileData.reminderTime) {
      const existingTime = onboardingData.profileData.reminderTime || '09:00';
      const isCustomTime = !this.reminderTimes.some(t => t.value === existingTime && t.value !== 'custom');
      
      this.profileForm.patchValue({
        displayName: displayName,
        gender: onboardingData.profileData.gender || '',
        birthday: onboardingData.profileData.birthday || '',
        reminderTime: isCustomTime ? 'custom' : existingTime,
        customTime: isCustomTime ? existingTime : '09:00',
        notifications: onboardingData.profileData.preferences?.notifications !== false
      });
      
      this.showCustomTime = isCustomTime;
    } else {
      // First time setup
      this.profileForm.patchValue({
        displayName: displayName
      });
    }
  }

  get progressPercentage() {
    return this.onboardingService.getProgressPercentage();
  }

  get canContinue() {
    return this.profileForm.valid;
  }

  get displayPhotoUrl(): string {
    if (this.selectedPhotoUrl) {
      return this.selectedPhotoUrl;
    }
    
    if (this.currentUser?.photoURL && !this.photoLoadError) {
      return this.currentUser.photoURL;
    }
    
    return '/assets/images/default-avatar.png';
  }

  onPhotoError() {
    console.log('Profile photo failed to load, using fallback');
    this.photoLoadError = true;
  }

  onSelectPhoto() {
    console.log('Opening photo selector...');
    
    // Create file input if it doesn't exist
    if (!this.fileInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = (event: any) => this.handleFileSelect(event);
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    } else {
      this.fileInput.nativeElement.click();
    }
  }

  handleFileSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      console.log('Photo selected:', file.name);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showToast('Please select an image file', 'warning');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('Please select an image smaller than 5MB', 'warning');
        return;
      }
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedPhotoUrl = e.target.result;
        this.photoLoadError = false;
        this.showToast('Photo selected successfully!', 'success');
        console.log('Photo preview ready');
      };
      reader.readAsDataURL(file);
    }
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    toast.present();
  }

  onPrevious() {
    this.onboardingService.previousStep();
  }

  /**
   * Detect user's timezone using browser APIs
   */
  private detectUserTimezone(): string {
    try {
      // Use Intl API to get the user's timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 Detected timezone via Intl API:', timezone);
      return timezone;
    } catch (error) {
      console.warn('⚠️ Failed to detect timezone via Intl API, falling back to UTC offset', error);
      
      // Fallback: Calculate timezone from UTC offset
      const now = new Date();
      const offsetMinutes = now.getTimezoneOffset();
      const offsetHours = Math.abs(offsetMinutes / 60);
      const sign = offsetMinutes > 0 ? '-' : '+';
      
      // This is a rough approximation - Intl API is much better
      const fallbackTimezone = `UTC${sign}${offsetHours.toString().padStart(2, '0')}:00`;
      console.log('🌍 Fallback timezone from offset:', fallbackTimezone);
      return fallbackTimezone;
    }
  }

  onContinue() {
    if (this.profileForm.valid) {
      const formData = this.profileForm.value;
      
      // Use custom time if selected, otherwise use preset time
      const finalReminderTime = formData.reminderTime === 'custom' 
        ? formData.customTime 
        : formData.reminderTime;
      
      // Auto-detect timezone
      const detectedTimezone = this.detectUserTimezone();
      
      const profileData = {
        displayName: formData.displayName,
        gender: formData.gender,
        birthday: formData.birthday,
        reminderTime: finalReminderTime,
        photoUrl: this.selectedPhotoUrl || this.currentUser?.photoURL, // Include selected photo or existing photo
        preferences: {
          notifications: formData.notifications,
          darkMode: false, // Default for now
          timezone: detectedTimezone // Auto-detected timezone
        }
      };
      
      // Update onboarding data
      this.onboardingService.updateProfileData(profileData);
      
      // Move to next step
      this.onboardingService.nextStep();
    }
  }

  onReminderTimeChange() {
    const selectedTime = this.profileForm.get('reminderTime')?.value;
    this.showCustomTime = selectedTime === 'custom';
  }

  onGenderChange() {
    // Optional: Add any specific logic when gender changes
    console.log('Gender selected:', this.profileForm.get('gender')?.value);
  }

  async onBirthdayClick() {
    // This method is no longer needed as we'll handle it in the template
    console.log('Birthday field clicked');
  }

  private async showNativeDatePicker() {
    // Removed - using HTML5 date input instead
  }

  getBirthdayDisplayValue(): string {
    const birthday = this.profileForm.get('birthday')?.value;
    if (birthday) {
      const date = new Date(birthday);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    return 'Select your birthday';
  }

  getMaxBirthdayForInput(): string {
    // Format for HTML5 date input (YYYY-MM-DD)
    const date = new Date(this.maxBirthday);
    return date.toISOString().split('T')[0];
  }

  getMinBirthdayForInput(): string {
    // Format for HTML5 date input (YYYY-MM-DD)
    const date = new Date(this.minBirthday);
    return date.toISOString().split('T')[0];
  }
}
