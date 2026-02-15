import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-tracker-card',
  templateUrl: './feed-tracker-card.component.html',
  styleUrls: ['./feed-tracker-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedTrackerCardComponent implements OnInit {
  @Input() item!: FeedItem;

  constructor() { }

  ngOnInit() {}

  get backgroundGradient(): string {
    // Default gradient if no specific color logic
    // In a real app, we'd map tracker category/color to a gradient
    const category = this.item.tags?.[0]?.toLowerCase() || 'default';
    
    switch (category) {
      case 'mind': return 'linear-gradient(135deg, #6366f1, #818cf8)'; // Indigo
      case 'body': return 'linear-gradient(135deg, #10b981, #34d399)'; // Emerald
      case 'soul': return 'linear-gradient(135deg, #f59e0b, #fbbf24)'; // Amber
      case 'beauty': return 'linear-gradient(135deg, #ec4899, #f472b6)'; // Pink
      default: return 'linear-gradient(135deg, #3b82f6, #60a5fa)'; // Blue
    }
  }

  get iconName(): string {
    // Extract icon from metrics or source if available, else default
    // This is a placeholder logic
    return 'checkmark-circle'; 
  }
}
