import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  icon?: string;
  color?: string;
  showCloseButton?: boolean;
  animated?: boolean;
  translucent?: boolean;
}

export interface ToastPreset {
  color: string;
  icon: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly presets: Record<string, ToastPreset> = {
    success: {
      color: 'success',
      icon: 'checkmark-circle',
      duration: 3000
    },
    error: {
      color: 'danger', 
      icon: 'alert-circle',
      duration: 5000
    },
    warning: {
      color: 'warning',
      icon: 'warning',
      duration: 4000
    },
    info: {
      color: 'primary',
      icon: 'information-circle',
      duration: 3000
    }
  };

  constructor(private toastController: ToastController) {}

  /**
   * Show a success toast
   */
  async showSuccess(message: string, options?: Partial<ToastOptions>): Promise<void> {
    await this.showToast({
      message,
      type: 'success',
      ...options
    });
  }

  /**
   * Show an error toast
   */
  async showError(message: string, options?: Partial<ToastOptions>): Promise<void> {
    await this.showToast({
      message,
      type: 'error',
      ...options
    });
  }

  /**
   * Show a warning toast
   */
  async showWarning(message: string, options?: Partial<ToastOptions>): Promise<void> {
    await this.showToast({
      message,
      type: 'warning',
      ...options
    });
  }

  /**
   * Show an info toast
   */
  async showInfo(message: string, options?: Partial<ToastOptions>): Promise<void> {
    await this.showToast({
      message,
      type: 'info',
      ...options
    });
  }

  /**
   * Show a custom toast with full control
   */
  async showToast(options: ToastOptions): Promise<void> {
    const preset = options.type ? this.presets[options.type] : null;
    
    const toast = await this.toastController.create({
      message: options.message,
      duration: options.duration || preset?.duration || 3000,
      position: options.position || 'bottom',
      color: options.color || preset?.color || 'dark',
      icon: options.icon || preset?.icon,
      animated: options.animated !== false,
      translucent: options.translucent || false,
      buttons: options.showCloseButton ? [
        {
          text: 'Close',
          role: 'cancel'
        }
      ] : undefined,
      cssClass: 'toast-custom'
    });

    await toast.present();
  }

  /**
   * Show a loading toast (long duration, with close button)
   */
  async showLoading(message: string): Promise<HTMLIonToastElement> {
    const toast = await this.toastController.create({
      message,
      position: 'bottom',
      color: 'primary',
      icon: 'hourglass',
      duration: 0, // Manual dismiss
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ],
      cssClass: 'toast-loading'
    });

    await toast.present();
    return toast;
  }

  /**
   * Show a toast with action button
   */
  async showWithAction(
    message: string, 
    actionText: string, 
    actionHandler: () => void,
    options?: Partial<ToastOptions>
  ): Promise<void> {
    const preset = options?.type ? this.presets[options.type] : null;
    
    const toast = await this.toastController.create({
      message,
      duration: options?.duration || preset?.duration || 5000,
      position: options?.position || 'bottom',
      color: options?.color || preset?.color || 'dark',
      icon: options?.icon || preset?.icon,
      buttons: [
        {
          text: actionText,
          handler: actionHandler
        },
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ],
      cssClass: 'toast-with-action'
    });

    await toast.present();
  }

  /**
   * Dismiss all active toasts
   */
  async dismissAll(): Promise<void> {
    const activeToast = await this.toastController.getTop();
    if (activeToast) {
      await activeToast.dismiss();
      // Recursively dismiss any remaining toasts
      await this.dismissAll();
    }
  }
} 