import { Component, Input, Output, EventEmitter, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	IonItemSliding,
	IonItem,
	IonItemOptions,
	IonItemOption,
	IonSpinner,
	AlertController,
	ActionSheetController
} from '@ionic/angular/standalone';

// Components
import { TrackerCardComponent } from '../tracker-card/tracker-card.component';

// Services
import { TrackerService } from '../../services/tracker.service';
import { LoggingService } from '../../services/logging.service';
import { ToastService } from '../../services/toast.service';
import { LoggingModalService } from '../../services/logging-modal.service';

// Models
import { Tracker } from '../../models/tracker.interface';
import { TrackerData } from '../../models/view-models.interface';

type SwipeAction = 'edit' | 'delete' | 'pause' | 'resume' | 'extend' | 'complete' | 'toggleMode';

@Component({
	selector: 'app-tracker-list-item',
	templateUrl: './tracker-list-item.component.html',
	styleUrls: ['./tracker-list-item.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		IonItemSliding,
		IonItem,
		IonItemOptions,
		IonItemOption,
		IonSpinner,
		TrackerCardComponent
	]
})
export class TrackerListItemComponent {
	private readonly trackerService = inject(TrackerService);
	private readonly alertController = inject(AlertController);
	private readonly actionSheetController = inject(ActionSheetController);
	private readonly loggingModalService = inject(LoggingModalService);
	private readonly logging = inject(LoggingService);
	private readonly toast = inject(ToastService);

	@ViewChild(IonItemSliding) slidingItem!: IonItemSliding;

	@Input() tracker!: TrackerData;
	@Input() showSwipeActions: boolean = true;
	@Input() compactMode: boolean = false;

	@Output() trackerUpdated = new EventEmitter<TrackerData>();
	@Output() trackerDeleted = new EventEmitter<string>();
	@Output() openDetail = new EventEmitter<TrackerData>();
	@Output() openEdit = new EventEmitter<TrackerData>();

	// Loading states for async actions
	isDeleting = false;
	isToggling = false;
	isExtending = false;
	isCompleting = false;

	// Swipe action handlers
	async onSwipeAction(action: SwipeAction) {
		await this.slidingItem?.close();

		switch (action) {
			case 'edit':
				this.handleEdit();
				break;
			case 'delete':
				this.handleDelete();
				break;
			case 'pause':
				this.handlePause();
				break;
			case 'resume':
				this.handleResume();
				break;
			case 'extend':
				this.handleExtend();
				break;
			case 'complete':
				this.handleComplete();
				break;
			case 'toggleMode':
				this.handleToggleMode();
				break;
		}
	}

	// Open action sheet with all options
	async openActionsMenu() {
		const buttons = [];

		// Edit option
		buttons.push({
			text: 'Edit Tracker',
			icon: 'create-outline',
			handler: () => this.handleEdit()
		});

		// Toggle mode
		if (this.tracker.isOngoing) {
			buttons.push({
				text: 'Convert to Challenge',
				icon: 'timer-outline',
				handler: () => this.handleToggleMode()
			});
		} else {
			buttons.push({
				text: 'Make Ongoing',
				icon: 'infinite-outline',
				handler: () => this.handleToggleMode()
			});
		}

		// Pause/Resume
		if (this.tracker.isActive) {
			buttons.push({
				text: 'Pause Tracker',
				icon: 'pause-outline',
				handler: () => this.handlePause()
			});
		} else {
			buttons.push({
				text: 'Resume Tracker',
				icon: 'play-outline',
				handler: () => this.handleResume()
			});
		}

		// Extend (for challenges only)
		if (!this.tracker.isOngoing && !this.tracker.isCompleted) {
			buttons.push({
				text: 'Extend Challenge',
				icon: 'add-circle-outline',
				handler: () => this.handleExtend()
			});
		}

		// Complete (for challenges only)
		if (!this.tracker.isOngoing && !this.tracker.isCompleted) {
			buttons.push({
				text: 'Complete Challenge',
				icon: 'checkmark-circle-outline',
				handler: () => this.handleComplete()
			});
		}

		// Delete
		buttons.push({
			text: 'Delete Tracker',
			icon: 'trash-outline',
			role: 'destructive',
			handler: () => this.handleDelete()
		});

		// Cancel
		buttons.push({
			text: 'Cancel',
			role: 'cancel'
		});

		const actionSheet = await this.actionSheetController.create({
			header: this.tracker.name,
			buttons
		});

		await actionSheet.present();
	}

	// Individual action handlers
	private handleEdit() {
		this.openEdit.emit(this.tracker);
	}

	private async handleDelete() {
		const alert = await this.alertController.create({
			header: 'Delete Tracker',
			message: `Are you sure you want to delete "${this.tracker.name}"? This action cannot be undone and all entries will be permanently deleted.`,
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel'
				},
				{
					text: 'Delete',
					role: 'destructive',
					handler: async () => {
						await this.performDelete();
					}
				}
			]
		});

		await alert.present();
	}

	private async performDelete() {
		try {
			this.isDeleting = true;
			await this.trackerService.deleteTracker(this.tracker.id);
			this.toast.showSuccess(`"${this.tracker.name}" deleted`);
			this.trackerDeleted.emit(this.tracker.id);
			this.logging.info('Tracker deleted', { trackerId: this.tracker.id });
		} catch (error) {
			this.logging.error('Failed to delete tracker', { error, trackerId: this.tracker.id });
			this.toast.showError('Failed to delete tracker');
		} finally {
			this.isDeleting = false;
		}
	}

	private async handlePause() {
		try {
			await this.trackerService.updateTracker(this.tracker.id, { isActive: false });
			this.toast.showSuccess(`"${this.tracker.name}" paused`);
			this.trackerUpdated.emit({ ...this.tracker, isActive: false });
			this.logging.info('Tracker paused', { trackerId: this.tracker.id });
		} catch (error) {
			this.logging.error('Failed to pause tracker', { error });
			this.toast.showError('Failed to pause tracker');
		}
	}

	private async handleResume() {
		try {
			await this.trackerService.updateTracker(this.tracker.id, { isActive: true });
			this.toast.showSuccess(`"${this.tracker.name}" resumed`);
			this.trackerUpdated.emit({ ...this.tracker, isActive: true });
			this.logging.info('Tracker resumed', { trackerId: this.tracker.id });
		} catch (error) {
			this.logging.error('Failed to resume tracker', { error });
			this.toast.showError('Failed to resume tracker');
		}
	}

	private async handleExtend() {
		const alert = await this.alertController.create({
			header: 'Extend Challenge',
			message: 'How many days would you like to extend this challenge?',
			inputs: [
				{ name: '7', type: 'radio', label: '7 days', value: 7, checked: true },
				{ name: '14', type: 'radio', label: '14 days', value: 14 },
				{ name: '30', type: 'radio', label: '30 days', value: 30 }
			],
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: 'Extend',
					handler: async (days: number) => {
						await this.performExtend(days);
					}
				}
			]
		});

		await alert.present();
	}

	private async performExtend(days: number) {
		try {
			this.isExtending = true;

			const currentEndDate = new Date(this.tracker.endDate);
			const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
			const newDurationDays = this.tracker.durationDays + days;
			const timesExtended = (this.tracker.timesExtended || 0) + 1;

			await this.trackerService.updateTracker(this.tracker.id, {
				endDate: newEndDate,
				durationDays: newDurationDays,
				timesExtended
			});

			const newDaysRemaining = Math.ceil((newEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

			this.toast.showSuccess(`Extended by ${days} days!`);
			this.trackerUpdated.emit({
				...this.tracker,
				endDate: newEndDate,
				durationDays: newDurationDays,
				timesExtended,
				daysRemaining: newDaysRemaining
			});
			this.logging.info('Tracker extended', { trackerId: this.tracker.id, days });
		} catch (error) {
			this.logging.error('Failed to extend tracker', { error });
			this.toast.showError('Failed to extend challenge');
		} finally {
			this.isExtending = false;
		}
	}

	private async handleComplete() {
		const alert = await this.alertController.create({
			header: 'Complete Challenge',
			message: `Are you sure you want to complete "${this.tracker.name}"? Your streak will be preserved and the challenge will move to your completed list.`,
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: 'Complete',
					handler: async () => {
						await this.performComplete();
					}
				}
			]
		});

		await alert.present();
	}

	private async performComplete() {
		try {
			this.isCompleting = true;

			await this.trackerService.updateTracker(this.tracker.id, {
				isCompleted: true,
				endDate: new Date(),
				isActive: false
			});

			this.toast.showSuccess(`🎉 "${this.tracker.name}" completed!`);
			this.trackerUpdated.emit({
				...this.tracker,
				isCompleted: true,
				isActive: false,
				daysRemaining: 0
			});
			this.logging.info('Tracker completed', { trackerId: this.tracker.id });
		} catch (error) {
			this.logging.error('Failed to complete tracker', { error });
			this.toast.showError('Failed to complete challenge');
		} finally {
			this.isCompleting = false;
		}
	}

	private async handleToggleMode() {
		const currentMode = this.tracker.isOngoing ? 'ongoing' : 'challenge';
		const newMode = this.tracker.isOngoing ? 'challenge' : 'ongoing';

		let message: string;
		let durationDays = 28;

		if (this.tracker.isOngoing) {
			message = 'Converting to a challenge will set a 28-day duration. Your current streak will be preserved.';
		} else {
			message = 'Converting to ongoing will remove the end date. Your current streak will be preserved.';
		}

		const alert = await this.alertController.create({
			header: `Convert to ${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`,
			message,
			inputs: this.tracker.isOngoing ? [
				{ name: '28', type: 'radio', label: '28 days', value: 28, checked: true },
				{ name: '66', type: 'radio', label: '66 days', value: 66 },
				{ name: '100', type: 'radio', label: '100 days', value: 100 }
			] : [],
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: 'Convert',
					handler: async (selectedDays?: number) => {
						if (selectedDays) {
							durationDays = selectedDays;
						}
						await this.performToggleMode(durationDays);
					}
				}
			]
		});

		await alert.present();
	}

	private async performToggleMode(durationDays: number = 28) {
		try {
			this.isToggling = true;

			const newIsOngoing = !this.tracker.isOngoing;
			const startDate = this.tracker.startDate;
			let endDate: Date;
			let newDaysRemaining: number;

			if (newIsOngoing) {
				// Converting to ongoing - set far future end date
				endDate = new Date(9999, 11, 31);
				newDaysRemaining = -1;
			} else {
				// Converting to challenge - calculate new end date from now
				endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
				newDaysRemaining = durationDays;
			}

			await this.trackerService.updateTracker(this.tracker.id, {
				isOngoing: newIsOngoing,
				endDate,
				durationDays: newIsOngoing ? 0 : durationDays
			});

			const modeLabel = newIsOngoing ? 'ongoing' : `${durationDays}-day challenge`;
			this.toast.showSuccess(`Converted to ${modeLabel}`);
			this.trackerUpdated.emit({
				...this.tracker,
				isOngoing: newIsOngoing,
				endDate,
				durationDays: newIsOngoing ? 0 : durationDays,
				daysRemaining: newDaysRemaining
			});
			this.logging.info('Tracker mode toggled', {
				trackerId: this.tracker.id,
				newMode: newIsOngoing ? 'ongoing' : 'challenge'
			});
		} catch (error) {
			this.logging.error('Failed to toggle tracker mode', { error });
			this.toast.showError('Failed to change mode');
		} finally {
			this.isToggling = false;
		}
	}

	// Card event handlers
	onQuickLog() {
		this.loggingModalService.openLogModal(this.tracker);
	}

	onOpenLogModal() {
		this.loggingModalService.openLogModal(this.tracker);
	}

	onCardClick() {
		this.openDetail.emit(this.tracker);
	}

	onExtendFromCard() {
		this.handleExtend();
	}

	onCompleteFromCard() {
		this.handleComplete();
	}

	// UI Helpers
	get isPaused(): boolean {
		return !this.tracker.isActive;
	}

	get trackerColor(): string {
		return this.tracker.color || '#6b7280';
	}
}
