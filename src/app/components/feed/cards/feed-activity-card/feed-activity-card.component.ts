import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-activity-card',
  templateUrl: './feed-activity-card.component.html',
  styleUrls: ['./feed-activity-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedActivityCardComponent implements OnInit {
  @Input() item!: FeedItem;

  constructor() { }

  ngOnInit() {}

  get timeAgo(): string {
    // Basic time ago logic or use a pipe if available
    if (!this.item.createdAt) return '';
    
    const date = this.item.createdAt.toDate ? this.item.createdAt.toDate() : new Date(this.item.createdAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }
}
