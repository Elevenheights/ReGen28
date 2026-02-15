import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-action-card',
  templateUrl: './feed-action-card.component.html',
  styleUrls: ['./feed-action-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedActionCardComponent {
  @Input() item!: FeedItem;
  isExpanded = false;

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }

  get categoryColor(): string {
    const category = this.item.metadata?.trackerCategory?.toLowerCase() || '';
    const colorMap: { [key: string]: string } = {
      'mind': '#6366f1',
      'body': '#10b981',
      'soul': '#f59e0b',
      'beauty': '#ec4899',
      'lifestyle': '#8b5cf6'
    };
    return colorMap[category] || '#6366f1';
  }

  get categoryGradient(): string {
    const category = this.item.metadata?.trackerCategory?.toLowerCase() || '';
    const gradientMap: { [key: string]: string } = {
      'mind': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      'body': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'soul': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'beauty': 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
      'lifestyle': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
    };
    return gradientMap[category] || 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
  }
}
