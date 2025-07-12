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
import { UserService } from '../../../services/user.service';
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
  library, 
  leaf 
} from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
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
      library, 
      leaf
    });

    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    console.log('Login page initialized');
    
    // Subscribe to auth state changes
    this.authService.authState$.subscribe(async (authState: any) => {
      console.log('Login page - Auth state changed:', {
        hasUser: !!authState.user,
        loading: authState.loading,
        error: authState.error
      });
      
      this.isLoading = authState.loading;
      this.errorMessage = authState.error;
      
      // If user is authenticated, check onboarding status and navigate
      if (authState.user && !authState.loading) {
        console.log('User authenticated, checking onboarding status...');
        
        try {
          // Wait a moment for user profile to be created
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          this.userService.getCurrentUserProfile().subscribe({
            next: (userProfile) => {
              console.log('User profile:', userProfile);
              
              if (userProfile && userProfile.isOnboardingComplete) {
                console.log('Onboarding complete, navigating to dashboard');
                this.router.navigate(['/tabs/dashboard']);
              } else {
                console.log('Onboarding needed, navigating to onboarding');
                this.router.navigate(['/onboarding']);
              }
            },
            error: (error) => {
              console.error('Error checking user profile:', error);
              // Default to onboarding if we can't get profile
              this.router.navigate(['/onboarding']);
            }
          });
        } catch (error) {
          console.error('Error during navigation:', error);
          this.router.navigate(['/onboarding']);
        }
      }
    });
  }

  async onLogin() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      
      try {
        await this.authService.login(email, password);
        // Navigation handled by auth state subscription
      } catch (error: any) {
        console.error('Login failed:', error);
        // Error handling is managed by AuthService state
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async onGoogleLogin() {
    console.log('Google login button clicked');
    try {
      console.log('Calling AuthService.loginWithGoogle()...');
      const result = await this.authService.loginWithGoogle();
      console.log('Google login result:', result);
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Google and back
    } catch (error: any) {
      console.error('Google login failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  async onAppleLogin() {
    try {
      const result = await this.authService.loginWithApple();
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Apple and back
    } catch (error: any) {
      console.error('Apple login failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  async onFacebookLogin() {
    try {
      const result = await this.authService.loginWithFacebook();
      // Navigation handled by auth state subscription
      // Note: On mobile, this will redirect to Facebook and back
    } catch (error: any) {
      console.error('Facebook login failed:', error);
      // Error handling is managed by AuthService state
    }
  }

  async onForgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      message: 'Enter your email address to receive a password reset link.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email address',
          value: this.loginForm.get('email')?.value || ''
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send Reset Link',
          handler: async (data) => {
            if (data.email) {
              try {
                await this.authService.sendPasswordResetEmail(data.email);
                await this.showSuccessAlert('Password reset link sent to your email.');
              } catch (error: any) {
                await this.showErrorAlert(error.message || 'Failed to send reset email.');
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
  }

  private markFormGroupTouched() {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
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
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['minlength']) return `${fieldName} must be at least 6 characters`;
    }
    return '';
  }

  clearError() {
    this.authService.clearError();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
} 