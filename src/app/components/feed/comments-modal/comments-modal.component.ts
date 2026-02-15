import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FeedService } from 'src/app/services/feed.service';
import { FeedComment } from 'src/app/models/feed-item.interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-comments-modal',
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class CommentsModalComponent implements OnInit {
  @Input() feedItemId!: string;
  
  comments: FeedComment[] = [];
  newCommentText = '';
  isLoading = false;
  isSending = false;

  constructor(
    private modalController: ModalController,
    private feedService: FeedService
  ) {}

  ngOnInit() {
    this.loadComments();
  }

  loadComments() {
    this.isLoading = true;
    this.feedService.getComments(this.feedItemId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading comments', error);
        this.isLoading = false;
      }
    });
  }

  async addComment() {
    if (!this.newCommentText.trim()) return;

    this.isSending = true;
    const text = this.newCommentText;
    this.newCommentText = ''; // Clear input immediately

    this.feedService.addComment(this.feedItemId, text).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.isSending = false;
      },
      error: (error) => {
        console.error('Error adding comment', error);
        this.newCommentText = text; // Restore text on error
        this.isSending = false;
      }
    });
  }

  close() {
    this.modalController.dismiss();
  }

  get timeAgo() {
    return (date: string | Date) => {
      if (!date) return '';
      const d = new Date(date);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
      return `${Math.floor(diffInSeconds / 86400)}d`;
    };
  }
}
