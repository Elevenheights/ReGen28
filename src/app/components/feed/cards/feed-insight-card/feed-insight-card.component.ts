import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-insight-card',
  templateUrl: './feed-insight-card.component.html',
  styleUrls: ['./feed-insight-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedInsightCardComponent {
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
    return colorMap[category] || '#3b82f6';
  }

  get categoryGradient(): string {
    const category = this.item.metadata?.trackerCategory?.toLowerCase() || '';
    const gradientMap: { [key: string]: string } = {
      'mind': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      'body': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      'soul': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      'beauty': 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
      'lifestyle': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
    };
    return gradientMap[category] || 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
  }

  get insightTypeLabel(): string {
    const type = this.item.metadata?.insightType || '';
    const labelMap: { [key: string]: string } = {
      'performance': 'Performance Analysis',
      'pattern': 'Pattern Detected',
      'opportunity': 'Growth Opportunity',
      'achievement': 'Achievement Unlocked'
    };
    return labelMap[type] || 'Strategic Insight';
  }
}
