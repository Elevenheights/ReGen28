import { Injectable } from '@angular/core';
import { TrackerCategory, TrackerType, TrackerFrequency, Tracker } from '../models/tracker.interface';

export interface DefaultTrackerTemplate {
  id: string;
  name: string;
  category: TrackerCategory;
  type: TrackerType;
  target: number;
  unit: string;
  frequency: TrackerFrequency;
  color: string;
  icon: string;
  description?: string;
}

export interface AppConfig {
  defaultTrackerDuration: number;
  maxPhotosPerTracker: number;
  suggestionsCacheDuration: number;
  cleanupBatchSize: number;
  defaultCommitmentLevel: string;
  fallbackRecommendationCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  
  private readonly appConfig: AppConfig = {
    defaultTrackerDuration: 28, // days
    maxPhotosPerTracker: 3,
    suggestionsCacheDuration: 24 * 60 * 60 * 1000, // 24 hours in ms
    cleanupBatchSize: 10,
    defaultCommitmentLevel: 'moderate',
    fallbackRecommendationCount: 3
  };

  private readonly defaultTrackerTemplates: DefaultTrackerTemplate[] = [
    // MIND TRACKERS
    {
      id: 'meditation',
      name: 'Meditation',
      category: TrackerCategory.MIND,
      type: TrackerType.DURATION,
      target: 10,
      unit: 'minutes',
      frequency: TrackerFrequency.DAILY,
      color: '#3b82f6',
      icon: 'fa-brain',
      description: 'Daily meditation practice for mindfulness and mental clarity'
    },
    {
      id: 'focus-sessions',
      name: 'Focus Sessions',
      category: TrackerCategory.MIND,
      type: TrackerType.COUNT,
      target: 3,
      unit: 'sessions',
      frequency: TrackerFrequency.DAILY,
      color: '#1e40af',
      icon: 'fa-bullseye',
      description: 'Deep work sessions without distractions'
    },
    {
      id: 'learning',
      name: 'Learning Time',
      category: TrackerCategory.MIND,
      type: TrackerType.DURATION,
      target: 2,
      unit: 'hours',
      frequency: TrackerFrequency.WEEKLY,
      color: '#1d4ed8',
      icon: 'fa-graduation-cap',
      description: 'Time spent learning new skills or knowledge'
    },
    {
      id: 'mindfulness',
      name: 'Mindfulness Practice',
      category: TrackerCategory.MIND,
      type: TrackerType.COUNT,
      target: 5,
      unit: 'minutes',
      frequency: TrackerFrequency.DAILY,
      color: '#2563eb',
      icon: 'fa-leaf',
      description: 'Mindful moments throughout the day'
    },

    // BODY TRACKERS
    {
      id: 'exercise',
      name: 'Exercise',
      category: TrackerCategory.BODY,
      type: TrackerType.COUNT,
      target: 4,
      unit: 'sessions',
      frequency: TrackerFrequency.WEEKLY,
      color: '#10b981',
      icon: 'fa-dumbbell',
      description: 'Physical activity and workout sessions'
    },
    {
      id: 'sleep',
      name: 'Sleep Quality',
      category: TrackerCategory.BODY,
      type: TrackerType.RATING,
      target: 8,
      unit: 'hours',
      frequency: TrackerFrequency.DAILY,
      color: '#059669',
      icon: 'fa-bed',
      description: 'Track your sleep duration each night'
    },
    {
      id: 'water',
      name: 'Water Intake',
      category: TrackerCategory.BODY,
      type: TrackerType.COUNT,
      target: 8,
      unit: 'glasses',
      frequency: TrackerFrequency.DAILY,
      color: '#0891b2',
      icon: 'fa-glass-water',
      description: 'Daily water consumption tracking'
    },
    {
      id: 'steps',
      name: 'Steps',
      category: TrackerCategory.BODY,
      type: TrackerType.COUNT,
      target: 10000,
      unit: 'steps',
      frequency: TrackerFrequency.DAILY,
      color: '#0d9488',
      icon: 'fa-walking',
      description: 'Daily step count for activity monitoring'
    },
    {
      id: 'stretching',
      name: 'Stretching',
      category: TrackerCategory.BODY,
      type: TrackerType.DURATION,
      target: 15,
      unit: 'minutes',
      frequency: TrackerFrequency.DAILY,
      color: '#059669',
      icon: 'fa-child-reaching',
      description: 'Daily stretching and flexibility exercises'
    },

    // SOUL TRACKERS
    {
      id: 'gratitude',
      name: 'Gratitude Practice',
      category: TrackerCategory.SOUL,
      type: TrackerType.COUNT,
      target: 1,
      unit: 'entry',
      frequency: TrackerFrequency.DAILY,
      color: '#8b5cf6',
      icon: 'fa-heart',
      description: 'Daily gratitude journaling and appreciation'
    },
    {
      id: 'prayer',
      name: 'Prayer/Meditation',
      category: TrackerCategory.SOUL,
      type: TrackerType.DURATION,
      target: 15,
      unit: 'minutes',
      frequency: TrackerFrequency.DAILY,
      color: '#7c3aed',
      icon: 'fa-praying-hands',
      description: 'Spiritual practice and connection time'
    },
    {
      id: 'social',
      name: 'Social Connection',
      category: TrackerCategory.SOUL,
      type: TrackerType.COUNT,
      target: 3,
      unit: 'interactions',
      frequency: TrackerFrequency.WEEKLY,
      color: '#6d28d9',
      icon: 'fa-users',
      description: 'Meaningful connections with others'
    },
    {
      id: 'kindness',
      name: 'Acts of Kindness',
      category: TrackerCategory.SOUL,
      type: TrackerType.COUNT,
      target: 2,
      unit: 'acts',
      frequency: TrackerFrequency.WEEKLY,
      color: '#5b21b6',
      icon: 'fa-hand-holding-heart',
      description: 'Random acts of kindness and giving'
    },

    // BEAUTY TRACKERS
    {
      id: 'skincare',
      name: 'Skincare Routine',
      category: TrackerCategory.BEAUTY,
      type: TrackerType.COUNT,
      target: 1,
      unit: 'routine',
      frequency: TrackerFrequency.DAILY,
      color: '#ec4899',
      icon: 'fa-sparkles',
      description: 'Morning and evening skincare routines'
    },
    {
      id: 'self-care',
      name: 'Self-Care Time',
      category: TrackerCategory.BEAUTY,
      type: TrackerType.DURATION,
      target: 2,
      unit: 'hours',
      frequency: TrackerFrequency.WEEKLY,
      color: '#db2777',
      icon: 'fa-spa',
      description: 'Dedicated time for personal care and relaxation'
    },
    {
      id: 'beauty',
      name: 'Beauty Practice',
      category: TrackerCategory.BEAUTY,
      type: TrackerType.COUNT,
      target: 1,
      unit: 'session',
      frequency: TrackerFrequency.WEEKLY,
      color: '#be185d',
      icon: 'fa-mirror',
      description: 'Beauty treatments and personal grooming'
    },
    {
      id: 'grooming',
      name: 'Grooming Time',
      category: TrackerCategory.BEAUTY,
      type: TrackerType.DURATION,
      target: 15,
      unit: 'minutes',
      frequency: TrackerFrequency.DAILY,
      color: '#9d174d',
      icon: 'fa-cut',
      description: 'Daily grooming and personal care'
    },

    // MOOD TRACKER (Universal)
    {
      id: 'mood',
      name: 'Daily Mood',
      category: TrackerCategory.MOOD,
      type: TrackerType.SCALE,
      target: 1,
      unit: 'check-in',
      frequency: TrackerFrequency.DAILY,
      color: '#f59e0b',
      icon: 'fa-face-smile',
      description: 'Track your overall mood and emotional state'
    },
    {
      id: 'energy',
      name: 'Energy Level',
      category: TrackerCategory.MOOD,
      type: TrackerType.SCALE,
      target: 1,
      unit: 'check-in',
      frequency: TrackerFrequency.DAILY,
      color: '#d97706',
      icon: 'fa-bolt',
      description: 'Monitor your daily energy levels'
    },
    {
      id: 'wellness',
      name: 'Overall Wellness',
      category: TrackerCategory.MOOD,
      type: TrackerType.SCALE,
      target: 1,
      unit: 'check-in',
      frequency: TrackerFrequency.DAILY,
      color: '#b45309',
      icon: 'fa-heart-pulse',
      description: 'Rate your overall sense of wellbeing'
    }
  ];

  /**
   * Get app configuration
   */
  getConfig(): AppConfig {
    return { ...this.appConfig };
  }

  /**
   * Get all default tracker templates
   */
  getDefaultTrackerTemplates(): DefaultTrackerTemplate[] {
    return [...this.defaultTrackerTemplates];
  }

  /**
   * Get specific tracker template by ID
   */
  getTrackerTemplate(id: string): DefaultTrackerTemplate | null {
    return this.defaultTrackerTemplates.find(template => template.id === id) || null;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TrackerCategory): DefaultTrackerTemplate[] {
    return this.defaultTrackerTemplates.filter(template => template.category === category);
  }

  /**
   * Create tracker from template
   */
  createTrackerFromTemplate(
    templateId: string, 
    userId: string, 
    customizations?: Partial<Tracker>
  ): Omit<Tracker, 'id' | 'createdAt' | 'updatedAt'> | null {
    const template = this.getTrackerTemplate(templateId);
    if (!template) return null;

    const now = new Date();
    return {
      userId,
      name: template.name,
      category: template.category,
      type: template.type,
      target: template.target,
      unit: template.unit,
      frequency: template.frequency,
      color: template.color,
      icon: template.icon,
      
      // Duration settings
      durationDays: this.appConfig.defaultTrackerDuration,
      startDate: now,
      endDate: new Date(now.getTime() + (this.appConfig.defaultTrackerDuration * 24 * 60 * 60 * 1000)),
      isCompleted: false,
      timesExtended: 0,
      isOngoing: false,
      
      isActive: true,
      isDefault: true,
      config: {
        reminderEnabled: false,
        requirePhotos: false,
        maxPhotos: this.appConfig.maxPhotosPerTracker
      },
      
      // Apply any customizations
      ...customizations
    };
  }

  /**
   * Get category display labels
   */
  getCategoryLabels(): { [key: string]: string } {
    return {
      'mind': 'Mental Wellness',
      'body': 'Physical Health', 
      'soul': 'Emotional Wellness',
      'beauty': 'Self Care',
      'mood': 'Mental Health',
      'lifestyle': 'Life Management'
    };
  }

  /**
   * Get fallback suggestions for when AI is unavailable
   */
  getFallbackSuggestions(): Array<{ name: string; category: string; icon: string; description: string; reason?: string }> {
    return [
      {
        name: 'Sleep Quality',
        category: 'body',
        icon: 'fa-bed',
        description: 'Track your rest and recovery',
        reason: 'Essential for overall health'
      },
      {
        name: 'Water Intake',
        category: 'body', 
        icon: 'fa-glass-water',
        description: 'Stay hydrated throughout the day',
        reason: 'Basic wellness foundation'
      },
      {
        name: 'Daily Mood',
        category: 'mood',
        icon: 'fa-face-smile',
        description: 'Monitor your emotional state',
        reason: 'Mental health awareness'
      }
    ];
  }
} 