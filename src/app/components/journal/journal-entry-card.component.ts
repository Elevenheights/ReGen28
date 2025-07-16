import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

// Models
import { JournalEntry } from '../../models/journal.interface';

@Component({
  selector: 'app-journal-entry-card',
  templateUrl: './journal-entry-card.component.html',
  styleUrls: ['./journal-entry-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class JournalEntryCardComponent {
  @Input() entry!: JournalEntry;
  @Input() showFullContent = false;
  @Input() maxContentLength = 100;
  @Output() entryClick = new EventEmitter<JournalEntry>();
  @Output() editClick = new EventEmitter<JournalEntry>();
  @Output() deleteClick = new EventEmitter<JournalEntry>();

  formatDate(date: string | Date): string {
    const entryDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return entryDate.toLocaleDateString();
    }
  }

  truncateContent(content: string): string {
    // Strip HTML tags to get plain text
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    
    if (this.showFullContent || plainText.length <= this.maxContentLength) {
      return plainText;
    }
    return plainText.substring(0, this.maxContentLength) + '...';
  }

  getMoodEmoji(mood?: number): string {
    if (!mood || mood < 1) return '😊';
    
    if (mood <= 2) return '😢';
    if (mood <= 4) return '😕';
    if (mood <= 6) return '😐';
    if (mood <= 8) return '😊';
    return '😄';
  }

  getCategoryIcon(category?: string): string {
    switch (category?.toLowerCase()) {
      case 'gratitude': return 'fa-heart';
      case 'reflection': return 'fa-star';
      case 'growth': return 'fa-trending-up';
      case 'mindfulness': return 'fa-leaf';
      case 'goals': return 'fa-target';
      case 'relationships': return 'fa-people-group';
      case 'health': return 'fa-dumbbell';
      case 'challenges': return 'fa-shield';
      case 'work': return 'fa-briefcase';
      case 'dreams': return 'fa-moon';
      default: return 'fa-pen';
    }
  }

  getCategoryDisplayName(category?: string): string {
    if (!category) return 'General';
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
  }

  onEntryClick(event: Event) {
    // Only emit if not clicking on action buttons
    const target = event.target as HTMLElement;
    if (!target.closest('.entry-actions')) {
      this.entryClick.emit(this.entry);
    }
  }

  onEditClick(event: Event) {
    event.stopPropagation();
    this.editClick.emit(this.entry);
  }

  onDeleteClick(event: Event) {
    event.stopPropagation();
    this.deleteClick.emit(this.entry);
  }

  getEnergyLabel(energy: number): string {
    const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
    return labels[energy - 1] || 'Medium';
  }

  getReadingTime(content: string): number {
    // Estimate reading time (average 200 words per minute)
    const words = content.split(' ').length;
    return Math.ceil(words / 200);
  }
} 