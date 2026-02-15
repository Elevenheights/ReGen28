import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { AuthService } from './auth.service';
import { from, Observable, switchMap, of, throwError } from 'rxjs';

export type MediaPathType = 'progress' | 'feed-card' | 'ai-generated' | 'wrapped-video';

export interface UploadResult {
  path: string;
  downloadUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {

  constructor(
    private storage: Storage,
    private authService: AuthService
  ) {}

  /**
   * Upload a file to the appropriate user path
   */
  uploadFile(file: File | Blob, type: MediaPathType, id: string): Observable<UploadResult> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return throwError(() => new Error('User not authenticated'));

        const path = this.getStoragePath(user.uid, type, id, file instanceof File ? file.name : 'image.jpg');
        const storageRef = ref(this.storage, path);

        return from(uploadBytes(storageRef, file)).pipe(
          switchMap(snapshot => from(getDownloadURL(snapshot.ref)).pipe(
            switchMap(url => of({ path, downloadUrl: url }))
          ))
        );
      })
    );
  }

  /**
   * Delete a file from storage
   */
  deleteFile(path: string): Observable<void> {
    const storageRef = ref(this.storage, path);
    return from(deleteObject(storageRef));
  }

  /**
   * Generate storage path based on type
   */
  private getStoragePath(userId: string, type: MediaPathType, id: string, filename: string): string {
    const timestamp = new Date().getTime();
    const extension = filename.split('.').pop() || 'jpg';
    
    switch (type) {
      case 'progress':
        return `user-media/${userId}/progress/${id}/${timestamp}.${extension}`;
      case 'feed-card':
        return `feed-media/${userId}/cards/${id}.${extension}`;
      case 'ai-generated':
        return `ai-media/${userId}/${id}/${timestamp}.${extension}`;
      case 'wrapped-video':
        return `wrapped-videos/${userId}/${id}/wrapped.mp4`;
      default:
        return `user-media/${userId}/misc/${id}/${timestamp}.${extension}`;
    }
  }
}
