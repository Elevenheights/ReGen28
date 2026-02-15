import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-milestone-card',
  templateUrl: './feed-milestone-card.component.html',
  styleUrls: ['./feed-milestone-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedMilestoneCardComponent implements OnInit {
  @Input() item!: FeedItem;

  constructor() { }

  ngOnInit() {}
}
