import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-stat-card',
  templateUrl: './feed-stat-card.component.html',
  styleUrls: ['./feed-stat-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedStatCardComponent implements OnInit {
  @Input() item!: FeedItem;

  constructor() { }

  ngOnInit() {}
}
