import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FeedItem } from 'src/app/models/feed-item.interface';

@Component({
  selector: 'app-feed-journal-card',
  templateUrl: './feed-journal-card.component.html',
  styleUrls: ['./feed-journal-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FeedJournalCardComponent implements OnInit {
  @Input() item!: FeedItem;

  constructor() { }

  ngOnInit() {}
}
