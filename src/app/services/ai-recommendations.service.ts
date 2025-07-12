import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';

export interface TrackerRecommendation {
  trackerId: string;
  reason: string;
  priority: number;
  customTarget?: number;
}

export interface AIRecommendationResponse {
  recommendations: TrackerRecommendation[];
  source: 'ai';
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIRecommendationsService {

  constructor(private functions: Functions) {}

  /**
   * Get AI-powered tracker recommendations based on user goals and focus areas
   * Now uses Firebase Cloud Function for better security and performance
   */
  getTrackerRecommendations(
    focusAreas: string[],
    goals: string[],
    commitmentLevel: 'light' | 'moderate' | 'intensive'
  ): Observable<AIRecommendationResponse> {
    console.log('🤖 Calling Firebase function for AI recommendations', {
      focusAreas,
      goals,
      commitmentLevel
    });

    // Call the Firebase Cloud Function
    const getRecommendations = httpsCallable(this.functions, 'getTrackerRecommendations');
    
    return from(getRecommendations({
      focusAreas,
      goals,
      commitmentLevel
    }).then((result: any) => {
      console.log('✅ AI recommendations received from Firebase', result.data);
      return result.data as AIRecommendationResponse;
    }).catch((error) => {
      console.error('❌ Error calling Firebase function:', error);
      throw new Error('Failed to get AI recommendations. Please try again or contact support.');
    }));
  }
} 