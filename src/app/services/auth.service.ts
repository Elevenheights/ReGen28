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
import { Observable, BehaviorSubject, from, of, switchMap, firstValueFrom, take } from 'rxjs';
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
    loading: false, // Start with false to avoid stuck loading state
    error: null
  });
  
  public authState$ = this.authStateSubject.asObservable();
  
  private userService?: UserService; // Lazy injection to avoid circular dependency

  constructor(private auth: Auth) {
    this.user$ = user(this.auth);
    
    // Initialize auth state
    this.initializeAuthState();
    
    // Check for redirect result on app load (for mobile OAuth)
    // Only if we're coming back from a redirect
    if (this.shouldCheckRedirectResult()) {
      this.handleRedirectResult();
    }
    
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
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for mobile user agents including Chrome Mobile
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Chrome.*Mobile|Mobile.*Chrome/i.test(userAgent);
    const isNarrowScreen = window.innerWidth <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isCapacitorApp = !!(window as any).Capacitor;
    
    console.log('Mobile detection:', {
      userAgent,
      isMobileUserAgent,
      isNarrowScreen,
      isTouchDevice,
      isCapacitorApp,
      windowWidth: window.innerWidth,
      maxTouchPoints: navigator.maxTouchPoints,
      final: isCapacitorApp || isMobileUserAgent || (isNarrowScreen && isTouchDevice)
    });
    
    // More robust mobile detection: 
    // - If it's a Capacitor app, always treat as mobile
    // - Check for mobile Chrome specifically
    // - Must have mobile user agent OR be narrow screen with touch capability
    return isCapacitorApp || isMobileUserAgent || (isNarrowScreen && isTouchDevice);
  }
  
  private shouldCheckRedirectResult(): boolean {
    // Check if we're coming back from an OAuth redirect
    // This prevents unnecessary loading states on normal app loads
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('code') || urlParams.has('state') || 
                          window.location.hash.includes('access_token') ||
                          sessionStorage.getItem('pendingOAuthRedirect') === 'true';
    
    console.log('Should check redirect result:', {
      hasOAuthParams,
      url: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      pendingRedirect: sessionStorage.getItem('pendingOAuthRedirect')
    });
    return hasOAuthParams;
  }

  private async handleRedirectResult(): Promise<void> {
    try {
      console.log('Checking for OAuth redirect result...');
      this.setLoading(true); // Set loading while checking
      
      const result = await getRedirectResult(this.auth);
      
      // Clear the pending redirect flag
      sessionStorage.removeItem('pendingOAuthRedirect');
      
      if (result?.user) {
        // User signed in via redirect (mobile OAuth flow)
        console.log('OAuth redirect successful:', result.user.email);
        // The auth state will be updated automatically by onAuthStateChanged
        // which will clear the loading state
      } else {
        console.log('No redirect result found');
        // Clear loading state since no redirect result
        this.setLoading(false);
      }
    } catch (error: any) {
      console.error('OAuth redirect error:', error);
      sessionStorage.removeItem('pendingOAuthRedirect');
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
      
      // Only set loading if we're actually processing something
      const currentState = this.authStateSubject.value;
      const isInitialLoad = currentState.user === null && user !== null;
      
      if (isInitialLoad) {
        this.setLoading(true);
      }
      
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
        // Check if user profile already exists
        const existingProfile = await firstValueFrom(userService.getCurrentUserProfile().pipe(take(1)));
        
        if (existingProfile) {
          console.log('✅ User profile already exists for:', user.email, 'skipping creation');
          
          // Check if existing user still has a Google photo URL that needs to be migrated
          if (existingProfile.photoURL && existingProfile.photoURL.includes('googleusercontent.com')) {
            console.log('🔄 Migrating existing Google photo URL to Firebase Storage...');
            try {
              const storedPhotoURL = await userService.downloadAndStoreGooglePhoto(existingProfile.photoURL);
              await userService.updateUserProfile({ photoURL: storedPhotoURL });
              console.log('✅ Successfully migrated Google photo to Firebase Storage');
            } catch (error) {
              console.error('❌ Failed to migrate Google photo:', error);
            }
          }
          
          return;
        }

        console.log('🆕 Creating new user profile for:', user.email);
        
        // Download and store Google profile photo if available
        let storedPhotoURL = '';
        if (user.photoURL) {
          console.log('📸 Downloading and storing Google profile photo...');
          storedPhotoURL = await userService.downloadAndStoreGooglePhoto(user.photoURL);
        }
        
        // Create basic user profile document in Firestore (only for new users)
        await userService.createUserProfile({
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: storedPhotoURL,
          joinDate: new Date(),
          currentDay: 1,
          streakCount: 0,
          isOnboardingComplete: false, // Will be set to true after onboarding
          // Subscription defaults
          status: 'active', // New users start with trial
          subscriptionType: 'trial', // Everyone gets a trial period
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day trial
          lastActiveAt: new Date(),
          preferences: {
            dailyReminders: true,
            reminderTime: '09:00',
            weeklyReports: true,
            milestoneNotifications: true,
            darkMode: false,
            language: 'en',
            timezone: 'UTC', // Default fallback, will be updated during onboarding
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
        console.log('✅ New user profile created in Firestore for:', user.email);
      } else {
        console.warn('⚠️ UserService not available, user profile creation deferred');
      }
    } catch (error) {
      console.error('❌ Error initializing user profile:', error);
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
    console.log('🔑 Starting Google login...');
    this.setLoading(true);
    this.setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // For Capacitor/mobile apps, always use popup to avoid redirect issues
      const isCapacitorApp = !!(window as any).Capacitor;
      
      if (this.isMobile() && !isCapacitorApp) {
        console.log('🔑 Using mobile redirect flow for Google login (web mobile)');
        // Set a flag to indicate we're expecting a redirect result
        sessionStorage.setItem('pendingOAuthRedirect', 'true');
        // Use redirect on mobile web for better UX
        await signInWithRedirect(this.auth, provider);
        console.log('🔑 Google redirect initiated, user will be redirected...');
        // Don't set loading to false here as the redirect is happening
        // handleRedirectResult() will handle the auth state when user returns
        return null; // Redirect will handle the rest
      } else {
        console.log('🔑 Using popup flow for Google login (desktop or Capacitor app)');
        // Use popup on desktop AND in Capacitor apps
        const result = await signInWithPopup(this.auth, provider);
        console.log('🔑 Google popup login successful:', result.user.email);
        this.setLoading(false);
        return result.user;
      }
    } catch (error: any) {
      console.error('🔑 Google login error:', error);
      this.setLoading(false);
      sessionStorage.removeItem('pendingOAuthRedirect');
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
      
      // For Capacitor/mobile apps, always use popup to avoid redirect issues
      const isCapacitorApp = !!(window as any).Capacitor;
      
      if (this.isMobile() && !isCapacitorApp) {
        // Set a flag to indicate we're expecting a redirect result
        sessionStorage.setItem('pendingOAuthRedirect', 'true');
        // Use redirect on mobile web for better UX
        await signInWithRedirect(this.auth, provider);
        // Don't set loading to false here as the redirect is happening
        // handleRedirectResult() will handle the auth state when user returns
        return null; // Redirect will handle the rest
      } else {
        // Use popup on desktop AND in Capacitor apps
        const result = await signInWithPopup(this.auth, provider);
        this.setLoading(false);
        return result.user;
      }
    } catch (error: any) {
      this.setLoading(false);
      sessionStorage.removeItem('pendingOAuthRedirect');
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
      
      // For Capacitor/mobile apps, always use popup to avoid redirect issues
      const isCapacitorApp = !!(window as any).Capacitor;
      
      if (this.isMobile() && !isCapacitorApp) {
        // Set a flag to indicate we're expecting a redirect result
        sessionStorage.setItem('pendingOAuthRedirect', 'true');
        // Use redirect on mobile web for better UX
        await signInWithRedirect(this.auth, provider);
        // Don't set loading to false here as the redirect is happening
        // handleRedirectResult() will handle the auth state when user returns
        return null; // Redirect will handle the rest
      } else {
        // Use popup on desktop AND in Capacitor apps
        const result = await signInWithPopup(this.auth, provider);
        this.setLoading(false);
        return result.user;
      }
    } catch (error: any) {
      this.setLoading(false);
      sessionStorage.removeItem('pendingOAuthRedirect');
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