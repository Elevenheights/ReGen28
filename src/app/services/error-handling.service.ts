import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { LoggingService } from './logging.service';

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  context?: any;
  timestamp: Date;
  category: ErrorCategory;
  retryable: boolean;
  suggestions?: string[];
}

export interface UIErrorState {
  hasError: boolean;
  errorMessage: string;
  isRetryable: boolean;
  suggestions: string[];
  showEmptyState: boolean;
  emptyStateMessage: string;
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network', 
  DATA = 'data',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown'
}

export enum ErrorCode {
  // Auth errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  
  // Data errors
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_INVALID = 'DATA_INVALID',
  DATA_SAVE_FAILED = 'DATA_SAVE_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  
  // AI/External service errors
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  OPENAI_ERROR = 'OPENAI_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  constructor(private logging: LoggingService) {}

  /**
   * Handle error gracefully and return observable with error info (no fallback data)
   */
  handleErrorGracefully<T>(
    operation: string,
    error: any,
    userMessage?: string
  ): Observable<never> {
    const appError = this.createAppError(error, operation, userMessage);
    
    this.logging.error(appError.message, {
      operation,
      error: appError,
      originalError: error
    });

    return throwError(() => appError);
  }

  /**
   * Create UI error state for components
   */
  createUIErrorState(
    error: AppError,
    emptyStateMessage: string = 'No data available'
  ): UIErrorState {
    return {
      hasError: true,
      errorMessage: error.userMessage,
      isRetryable: error.retryable,
      suggestions: error.suggestions || [],
      showEmptyState: false,
      emptyStateMessage
    };
  }

  /**
   * Create empty state (not an error, just no data)
   */
  createEmptyState(message: string = 'No data available'): UIErrorState {
    return {
      hasError: false,
      errorMessage: '',
      isRetryable: false,
      suggestions: [],
      showEmptyState: true,
      emptyStateMessage: message
    };
  }

  /**
   * Create success state (no errors, data loaded)
   */
  createSuccessState(): UIErrorState {
    return {
      hasError: false,
      errorMessage: '',
      isRetryable: false,
      suggestions: [],
      showEmptyState: false,
      emptyStateMessage: ''
    };
  }

  /**
   * Handle error and return user-friendly message (DEPRECATED - use handleErrorGracefully)
   */
  handleError<T>(
    operation: string,
    error: any,
    fallbackValue?: T,
    userMessage?: string
  ): Observable<T> {
    this.logging.warn('handleError with fallbackValue is deprecated, use handleErrorGracefully instead');
    
    const appError = this.createAppError(error, operation, userMessage);
    
    this.logging.error(appError.message, {
      operation,
      error: appError,
      originalError: error
    });

    // Return fallback value if provided (deprecated behavior)
    if (fallbackValue !== undefined) {
      return of(fallbackValue);
    }

    // Re-throw as standardized error
    throw appError;
  }

  /**
   * Create standardized error object with enhanced UI support
   */
  createAppError(error: any, context?: string, customUserMessage?: string): AppError {
    let code = ErrorCode.UNKNOWN_ERROR;
    let message = 'An unexpected error occurred';
    let userMessage = customUserMessage || 'Something went wrong. Please try again.';
    let category = ErrorCategory.UNKNOWN;
    let retryable = false;
    let suggestions: string[] = [];

    // Parse Firebase errors
    if (error?.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          code = ErrorCode.AUTH_INVALID_CREDENTIALS;
          category = ErrorCategory.AUTHENTICATION;
          userMessage = 'Invalid email or password';
          suggestions = ['Double-check your email and password', 'Try using the "Forgot Password" option'];
          break;
        case 'auth/permission-denied':
          code = ErrorCode.AUTH_PERMISSION_DENIED;
          category = ErrorCategory.PERMISSION;
          userMessage = 'You don\'t have permission to perform this action';
          suggestions = ['Make sure you\'re logged in', 'Contact support if this persists'];
          break;
        case 'firestore/not-found':
          code = ErrorCode.DATA_NOT_FOUND;
          category = ErrorCategory.DATA;
          userMessage = 'The requested data was not found';
          suggestions = ['The item may have been deleted', 'Try refreshing the page'];
          retryable = true;
          break;
        case 'firestore/permission-denied':
          code = ErrorCode.AUTH_PERMISSION_DENIED;
          category = ErrorCategory.PERMISSION;
          userMessage = 'Access denied';
          suggestions = ['Make sure you\'re logged in', 'Contact support if this persists'];
          break;
        case 'firestore/unavailable':
          code = ErrorCode.FIREBASE_ERROR;
          category = ErrorCategory.SERVICE_UNAVAILABLE;
          userMessage = 'Service temporarily unavailable';
          suggestions = ['Please try again in a few moments'];
          retryable = true;
          break;
        default:
          code = ErrorCode.FIREBASE_ERROR;
          category = ErrorCategory.NETWORK;
          message = error.message || message;
          retryable = true;
          suggestions = ['Check your internet connection', 'Try again in a few moments'];
      }
    }
    // Parse HTTP errors
    else if (error?.status) {
      category = ErrorCategory.NETWORK;
      retryable = true;
      
      switch (error.status) {
        case 401:
          code = ErrorCode.AUTH_PERMISSION_DENIED;
          category = ErrorCategory.AUTHENTICATION;
          userMessage = 'Authentication required';
          suggestions = ['Please log in again'];
          retryable = false;
          break;
        case 403:
          code = ErrorCode.AUTH_PERMISSION_DENIED;
          category = ErrorCategory.PERMISSION;
          userMessage = 'Access forbidden';
          suggestions = ['Contact support for access'];
          retryable = false;
          break;
        case 404:
          code = ErrorCode.DATA_NOT_FOUND;
          category = ErrorCategory.DATA;
          userMessage = 'Resource not found';
          suggestions = ['The item may have been moved or deleted'];
          break;
        case 500:
          code = ErrorCode.NETWORK_ERROR;
          userMessage = 'Server error. Please try again later.';
          suggestions = ['Try again in a few minutes', 'Contact support if this persists'];
          break;
        case 0:
          code = ErrorCode.NETWORK_ERROR;
          userMessage = 'No internet connection';
          suggestions = ['Check your internet connection', 'Try again when you\'re back online'];
          break;
        default:
          code = ErrorCode.NETWORK_ERROR;
          userMessage = 'Network error. Please check your connection.';
          suggestions = ['Check your internet connection', 'Try again in a few moments'];
      }
    }
    // Parse OpenAI errors
    else if (error?.message?.includes('OpenAI') || error?.name === 'OpenAIError') {
      code = ErrorCode.OPENAI_ERROR;
      category = ErrorCategory.SERVICE_UNAVAILABLE;
      userMessage = 'AI service is temporarily unavailable';
      suggestions = ['AI recommendations are temporarily offline', 'Basic features are still available'];
      retryable = true;
    }
    // Generic error
    else if (error?.message) {
      message = error.message;
      if (error.message.includes('network') || error.message.includes('fetch')) {
        category = ErrorCategory.NETWORK;
        retryable = true;
        suggestions = ['Check your internet connection', 'Try again in a few moments'];
      }
    }

    return {
      code,
      message: `${context ? `[${context}] ` : ''}${message}`,
      userMessage,
      context,
      timestamp: new Date(),
      category,
      retryable,
      suggestions
    };
  }

  /**
   * Get retry suggestion message
   */
  getRetryMessage(error: AppError): string {
    if (!error.retryable) {
      return '';
    }
    
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Tap to retry once you\'re back online';
      case ErrorCategory.SERVICE_UNAVAILABLE:
        return 'Tap to try again';
      default:
        return 'Tap to retry';
    }
  }

  /**
   * Log warning with consistent format
   */
  logWarning(message: string, context?: any): void {
    this.logging.warn(message, context);
  }

  /**
   * Log info with consistent format
   */
  logInfo(message: string, context?: any): void {
    this.logging.info(message, context);
  }
} 