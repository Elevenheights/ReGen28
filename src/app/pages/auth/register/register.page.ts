import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { 
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService, AuthError } from '../../../services/auth.service';
import { addIcons } from 'ionicons';
import { 
  heart, 
  logoGoogle, 
  logoApple, 
  logoFacebook, 
  eye, 
  eyeOff, 
  alertCircle, 
  close, 
  calendar, 
  trendingUp, 
  people 
} from 'ionicons/icons';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner
  ]
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    // Add icons to the registry
    addIcons({
      heart, 
      logoGoogle, 
      logoApple, 
      logoFacebook, 
      eye, 
      eyeOff, 
      alertCircle, 
      close, 
      calendar, 
      trendingUp, 
      people
    });

    this.registerForm = this.formBuilder.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Subscribe to auth state changes
    this.authService.authState$.subscribe((authState: any) => {
      this.isLoading = authState.loading;
      this.errorMessage = authState.error;
      
      // If user is authenticated, navigate to onboarding
      if (authState.user && !authState.loading) {
        this.router.navigate(['/onboarding']);
      }
    });
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  async onRegister() {
    if (this.registerForm.valid) {
      const { displayName, email, password } = this.registerForm.value;
      
      try {
        await this.authService.register(email, password, displayName);
        // Show success message about email verification
        await this.showEmailVerificationAlert();
        // Navigation to onboarding handled by auth state subscription
      } catch (error: any) {
        console.error('Registration failed:', error);
        // Error handling is managed by AuthService state
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async onGoogleRegister() {
    try {
      const result = await this.authService.loginWithGoogle();
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Google and back
    } catch (error: any) {
      console.error('Google registration failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  async onAppleRegister() {
    try {
      const result = await this.authService.loginWithApple();
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Apple and back
    } catch (error: any) {
      console.error('Apple registration failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  async onFacebookRegister() {
    try {
      const result = await this.authService.loginWithFacebook();
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Facebook and back
    } catch (error: any) {
      console.error('Facebook registration failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  private async showEmailVerificationAlert() {
    const alert = await this.alertController.create({
      header: 'Verify Your Email',
      message: 'We\'ve sent a verification email to your address. Please check your inbox and verify your email before continuing.',
      buttons: [
        {
          text: 'Resend Email',
          handler: async () => {
            try {
              await this.authService.sendEmailVerification();
              await this.showSuccessAlert('Verification email resent!');
            } catch (error: any) {
              await this.showErrorAlert('Failed to resend email. Please try again.');
            }
          }
        },
        {
          text: 'Continue',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  private markFormGroupTouched() {
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
    });
  }

  private async showSuccessAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Success',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['minlength']) {
        if (fieldName === 'password') return 'Password must be at least 6 characters';
        if (fieldName === 'displayName') return 'Name must be at least 2 characters';
      }
    }
    return '';
  }

  getPasswordConfirmError(): string {
    const confirmField = this.registerForm.get('confirmPassword');
    if (confirmField?.touched) {
      if (confirmField.errors?.['required']) return 'Please confirm your password';
      if (this.registerForm.errors?.['passwordMismatch']) return 'Passwords do not match';
    }
    return '';
  }

  clearError() {
    this.authService.clearError();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
} 