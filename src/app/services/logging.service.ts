import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private logLevel: LogLevel = environment.production ? LogLevel.WARN : LogLevel.DEBUG;
  private prefix = '[Regen28]';

  /**
   * Log error messages
   */
  error(message: string, context?: any): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`${this.prefix} [ERROR] ${message}`, context || '');
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`${this.prefix} [WARN] ${message}`, context || '');
    }
  }

  /**
   * Log info messages
   */
  info(message: string, context?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(`${this.prefix} [INFO] ${message}`, context || '');
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`${this.prefix} [DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log operation start (for performance tracking)
   */
  startOperation(operation: string, context?: any): void {
    this.debug(`Starting operation: ${operation}`, context);
  }

  /**
   * Log operation completion (for performance tracking)
   */
  endOperation(operation: string, duration?: number, context?: any): void {
    const durationText = duration ? ` (${duration}ms)` : '';
    this.debug(`Completed operation: ${operation}${durationText}`, context);
  }
} 