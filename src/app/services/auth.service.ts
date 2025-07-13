import { Injectable } from '@angular/core';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  user, 
  User,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged
} from '@angular/fire/auth';
import { Observable, BehaviorSubject, from, of, switchMap, firstValueFrom } from 'rxjs';
import { UserService } from './user.service';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthError {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null>;
  
  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    loading: true,
    error: null
  });
  
  public authState$ = this.authStateSubject.asObservable();
  
  private userService?: UserService; // Lazy injection to avoid circular dependency

  constructor(private auth: Auth) {
    this.user$ = user(this.auth);
    
    // Initialize auth state
    this.initializeAuthState();
    
    // Check for redirect result on app load (for mobile OAuth)
    this.handleRedirectResult();
    
    // Initialize UserService connection after a brief delay to avoid circular dependency
    setTimeout(() => {
      this.initializeUserServiceConnection();
    }, 100);
  }
  
  private async initializeUserServiceConnection(): Promise<void> {
    try {
      const { UserService } = await import('./user.service');
      // Note: We can't directly instantiate UserService here due to dependency injection
      // This will be handled by the component that uses both services
    } catch (error) {
      console.warn('Could not initialize UserService connection:', error);
    }
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  private async handleRedirectResult(): Promise<void> {
    try {
      console.log('Checking for OAuth redirect result...');
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        // User signed in via redirect (mobile OAuth flow)
        console.log('OAuth redirect successful:', result.user.email);
        // The auth state will be updated automatically by onAuthStateChanged
      } else {
        console.log('No redirect result found');
      }
    } catch (error: any) {
      console.error('OAuth redirect error:', error);
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
    }
  }

  // Set UserService manually to avoid circular dependency during injection
  public setUserService(userService: UserService): void {
    this.userService = userService;
  }
  
  private getUserService(): UserService | null {
    return this.userService || null;
  }

  private initializeAuthState(): void {
    onAuthStateChanged(this.auth, async (user) => {
      console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
      this.setLoading(true);
      
      if (user) {
        // User is signed in
        console.log('User authenticated, initializing profile...');
        
        // Initialize user profile if needed
        await this.initializeUserProfile(user);
        
        this.authStateSubject.next({
          user,
          loading: false,
          error: null
        });
      } else {
        // User is signed out
        console.log('User signed out');
        this.authStateSubject.next({
          user: null,
          loading: false,
          error: null
        });
      }
    });
  }

  private async initializeUserProfile(user: User): Promise<void> {
    try {
      const userService = this.getUserService();
      if (userService) {
        // Create basic user profile document in Firestore
        await userService.createUserProfile({
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          joinDate: new Date(),
          currentDay: 1,
          streakCount: 0,
          isOnboardingComplete: false, // Will be set to true after onboarding
          preferences: {
            dailyReminders: true,
            reminderTime: '09:00',
            weeklyReports: true,
            milestoneNotifications: true,
            darkMode: false,
            language: 'en',
            dataSharing: false,
            analytics: true,
            backupEnabled: true
          },
          stats: {
            totalTrackerEntries: 0,
            totalJournalEntries: 0,
            totalMeditationMinutes: 0,
            completedTrackers: 0,
            currentStreaks: 0,
            longestStreak: 0,
            weeklyActivityScore: 0,
            monthlyGoalsCompleted: 0
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ User profile created in Firestore for:', user.email);
      } else {
        console.warn('⚠️ UserService not available, user profile creation deferred');
      }
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
  }

  private setLoading(loading: boolean): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading
    });
  }

  private setError(error: string | null): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      error,
      loading: false
    });
  }

  private handleAuthError(error: any): AuthError {
    let message = 'An unexpected error occurred';
    
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email address';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        message = 'Network error. Please check your connection';
        break;
      case 'auth/popup-closed-by-user':
        message = 'Sign-in popup was closed';
        break;
      case 'auth/cancelled-popup-request':
        message = 'Sign-in was cancelled';
        break;
      case 'auth/account-exists-with-different-credential':
        message = 'An account already exists with the same email but different sign-in method';
        break;
      case 'auth/credential-already-in-use':
        message = 'This credential is already associated with a different user account';
        break;
      case 'auth/operation-not-allowed':
        message = 'This sign-in method is not enabled. Please contact support';
        break;
      default:
        message = error.message || 'Authentication failed';
    }

    return {
      code: error.code || 'unknown',
      message
    };
  }

  async login(email: string, password: string): Promise<User> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (!result.user.emailVerified) {
        console.warn('User email not verified');
        // You might want to handle unverified emails differently
      }
      
      return result.user;
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    }
  }

  async register(email: string, password: string, displayName?: string): Promise<User> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update profile with display name if provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
      }
      
      // Create user document in Firestore immediately after successful registration
      await this.initializeUserProfile(result.user);
      
      // Send email verification
      await this.sendEmailVerification();
      
      return result.user;
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    } finally {
      this.setLoading(false);
    }
  }

  async loginWithGoogle(): Promise<User | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      if (this.isMobile()) {
        // Use redirect on mobile for better UX
        await signInWithRedirect(this.auth, provider);
        return null; // Redirect will handle the rest
      } else {
        // Use popup on desktop
        const result = await signInWithPopup(this.auth, provider);
        return result.user;
      }
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    }
  }

  async loginWithApple(): Promise<User | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      
      if (this.isMobile()) {
        // Use redirect on mobile for better UX
        await signInWithRedirect(this.auth, provider);
        return null; // Redirect will handle the rest
      } else {
        // Use popup on desktop
        const result = await signInWithPopup(this.auth, provider);
        return result.user;
      }
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    }
  }

  async loginWithFacebook(): Promise<User | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      
      if (this.isMobile()) {
        // Use redirect on mobile for better UX
        await signInWithRedirect(this.auth, provider);
        return null; // Redirect will handle the rest
      } else {
        // Use popup on desktop
        const result = await signInWithPopup(this.auth, provider);
        return result.user;
      }
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    }
  }

  async logout(): Promise<void> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      await signOut(this.auth);
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      this.setError(authError.message);
      throw authError;
    } finally {
      this.setLoading(false);
    }
  }

  async sendEmailVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');
    
    try {
      await sendEmailVerification(user);
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      throw authError;
    }
  }

  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');
    
    try {
      await updateProfile(user, updates);
    } catch (error: any) {
      const authError = this.handleAuthError(error);
      throw authError;
    }
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.auth.currentUser;
  }

  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified || false;
  }

  getAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  // Helper method to check if user is loading
  isLoading(): boolean {
    return this.authStateSubject.value.loading;
  }

  // Helper method to get current error
  getError(): string | null {
    return this.authStateSubject.value.error;
  }

  // Clear any current error
  clearError(): void {
    this.setError(null);
  }

  // Observable that emits true when user is authenticated
  get isAuthenticated$(): Observable<boolean> {
    return this.user$.pipe(
      switchMap(user => of(!!user))
    );
  }

  // Observable that emits when auth is ready (no longer loading)
  get authReady$(): Observable<boolean> {
    return this.authState$.pipe(
      switchMap(state => of(!state.loading))
    );
  }
} 