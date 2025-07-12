/**
 * Shared configuration between client and Firebase Functions
 * This ensures consistency in tracker templates and app configuration
 */

export interface DefaultTrackerTemplate {
  id: string;
  name: string;
  category: string;
  type: string;
  target: number;
  unit: string;
  frequency: string;
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

export const APP_CONFIG: AppConfig = {
  defaultTrackerDuration: 28, // days
  maxPhotosPerTracker: 3,
  suggestionsCacheDuration: 24 * 60 * 60 * 1000, // 24 hours in ms
  cleanupBatchSize: 10,
  defaultCommitmentLevel: 'moderate',
  fallbackRecommendationCount: 3
};

export const DEFAULT_TRACKER_TEMPLATES: DefaultTrackerTemplate[] = [
  // MIND TRACKERS
  {
    id: 'meditation',
    name: 'Meditation',
    category: 'mind',
    type: 'duration',
    target: 10,
    unit: 'minutes',
    frequency: 'daily',
    color: '#3b82f6',
    icon: 'fa-brain',
    description: 'Daily meditation practice for mindfulness and mental clarity'
  },
  {
    id: 'focus-sessions',
    name: 'Focus Sessions',
    category: 'mind',
    type: 'count',
    target: 3,
    unit: 'sessions',
    frequency: 'daily',
    color: '#1e40af',
    icon: 'fa-bullseye',
    description: 'Deep work sessions without distractions'
  },
  {
    id: 'learning',
    name: 'Learning Time',
    category: 'mind',
    type: 'duration',
    target: 2,
    unit: 'hours',
    frequency: 'weekly',
    color: '#1d4ed8',
    icon: 'fa-graduation-cap',
    description: 'Time spent learning new skills or knowledge'
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness Practice',
    category: 'mind',
    type: 'count',
    target: 5,
    unit: 'minutes',
    frequency: 'daily',
    color: '#2563eb',
    icon: 'fa-leaf',
    description: 'Mindful moments throughout the day'
  },

  // BODY TRACKERS
  {
    id: 'exercise',
    name: 'Exercise',
    category: 'body',
    type: 'count',
    target: 4,
    unit: 'sessions',
    frequency: 'weekly',
    color: '#10b981',
    icon: 'fa-dumbbell',
    description: 'Physical activity and workout sessions'
  },
  {
    id: 'sleep',
    name: 'Sleep Quality',
    category: 'body',
    type: 'rating',
    target: 8,
    unit: 'hours',
    frequency: 'daily',
    color: '#059669',
    icon: 'fa-bed',
    description: 'Track your sleep duration each night'
  },
  {
    id: 'water',
    name: 'Water Intake',
    category: 'body',
    type: 'count',
    target: 8,
    unit: 'glasses',
    frequency: 'daily',
    color: '#0891b2',
    icon: 'fa-glass-water',
    description: 'Daily water consumption tracking'
  },
  {
    id: 'steps',
    name: 'Steps',
    category: 'body',
    type: 'count',
    target: 10000,
    unit: 'steps',
    frequency: 'daily',
    color: '#0d9488',
    icon: 'fa-walking',
    description: 'Daily step count for activity monitoring'
  },
  {
    id: 'stretching',
    name: 'Stretching',
    category: 'body',
    type: 'duration',
    target: 15,
    unit: 'minutes',
    frequency: 'daily',
    color: '#059669',
    icon: 'fa-child-reaching',
    description: 'Daily stretching and flexibility exercises'
  },

  // SOUL TRACKERS
  {
    id: 'gratitude',
    name: 'Gratitude Practice',
    category: 'soul',
    type: 'count',
    target: 1,
    unit: 'entry',
    frequency: 'daily',
    color: '#8b5cf6',
    icon: 'fa-heart',
    description: 'Daily gratitude journaling and appreciation'
  },
  {
    id: 'prayer',
    name: 'Prayer/Meditation',
    category: 'soul',
    type: 'duration',
    target: 15,
    unit: 'minutes',
    frequency: 'daily',
    color: '#7c3aed',
    icon: 'fa-praying-hands',
    description: 'Spiritual practice and connection time'
  },
  {
    id: 'social',
    name: 'Social Connection',
    category: 'soul',
    type: 'count',
    target: 3,
    unit: 'interactions',
    frequency: 'weekly',
    color: '#6d28d9',
    icon: 'fa-users',
    description: 'Meaningful connections with others'
  },
  {
    id: 'kindness',
    name: 'Acts of Kindness',
    category: 'soul',
    type: 'count',
    target: 2,
    unit: 'acts',
    frequency: 'weekly',
    color: '#5b21b6',
    icon: 'fa-hand-holding-heart',
    description: 'Random acts of kindness and giving'
  },

  // BEAUTY TRACKERS
  {
    id: 'skincare',
    name: 'Skincare Routine',
    category: 'beauty',
    type: 'count',
    target: 1,
    unit: 'routine',
    frequency: 'daily',
    color: '#ec4899',
    icon: 'fa-sparkles',
    description: 'Morning and evening skincare routines'
  },
  {
    id: 'self-care',
    name: 'Self-Care Time',
    category: 'beauty',
    type: 'duration',
    target: 2,
    unit: 'hours',
    frequency: 'weekly',
    color: '#db2777',
    icon: 'fa-spa',
    description: 'Dedicated time for personal care and relaxation'
  },
  {
    id: 'beauty',
    name: 'Beauty Practice',
    category: 'beauty',
    type: 'count',
    target: 1,
    unit: 'session',
    frequency: 'weekly',
    color: '#be185d',
    icon: 'fa-mirror',
    description: 'Beauty treatments and personal grooming'
  },
  {
    id: 'grooming',
    name: 'Grooming Time',
    category: 'beauty',
    type: 'duration',
    target: 15,
    unit: 'minutes',
    frequency: 'daily',
    color: '#9d174d',
    icon: 'fa-cut',
    description: 'Daily grooming and personal care'
  },

  // MOOD TRACKER (Universal)
  {
    id: 'mood',
    name: 'Daily Mood',
    category: 'mood',
    type: 'scale',
    target: 1,
    unit: 'check-in',
    frequency: 'daily',
    color: '#f59e0b',
    icon: 'fa-face-smile',
    description: 'Track your overall mood and emotional state'
  },
  {
    id: 'energy',
    name: 'Energy Level',
    category: 'mood',
    type: 'scale',
    target: 1,
    unit: 'check-in',
    frequency: 'daily',
    color: '#d97706',
    icon: 'fa-bolt',
    description: 'Monitor your daily energy levels'
  },
  {
    id: 'wellness',
    name: 'Overall Wellness',
    category: 'mood',
    type: 'scale',
    target: 1,
    unit: 'check-in',
    frequency: 'daily',
    color: '#b45309',
    icon: 'fa-heart-pulse',
    description: 'Rate your overall sense of wellbeing'
  }
];

/**
 * Get tracker template by ID
 */
export function getTrackerTemplate(trackerId: string): DefaultTrackerTemplate | null {
  return DEFAULT_TRACKER_TEMPLATES.find(template => template.id === trackerId) || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): DefaultTrackerTemplate[] {
  return DEFAULT_TRACKER_TEMPLATES.filter(template => template.category === category);
}

/**
 * Get fallback suggestions for daily recommendations
 */
export function getFallbackDailySuggestions(): Array<{ text: string; type: string; icon: string }> {
  return [
    {
      text: 'Start your day with 5 minutes of mindful breathing',
      type: 'mindfulness',
      icon: '🧘'
    },
    {
      text: 'Take a moment to appreciate something beautiful around you',
      type: 'gratitude',
      icon: '✨'
    },
    {
      text: 'Stay hydrated - drink a glass of water now',
      type: 'physical',
      icon: '💧'
    }
  ];
}

/**
 * Get fallback tracker recommendations
 */
export function getFallbackTrackerRecommendations(): Array<{ name: string; category: string; icon: string; description: string; reason?: string }> {
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

/**
 * Get category display labels
 */
export function getCategoryLabels(): { [key: string]: string } {
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
 * Create tracker data from template with customizations
 */
export function createTrackerFromTemplate(
  templateId: string, 
  userId: string, 
  customizations?: any,
  serverTimestamp?: any
): any | null {
  const template = getTrackerTemplate(templateId);
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
    durationDays: APP_CONFIG.defaultTrackerDuration,
    startDate: now,
    endDate: new Date(now.getTime() + (APP_CONFIG.defaultTrackerDuration * 24 * 60 * 60 * 1000)),
    isCompleted: false,
    timesExtended: 0,
    isOngoing: false,
    
    isActive: true,
    isDefault: true,
    config: {
      reminderEnabled: false,
      requirePhotos: false,
      maxPhotos: APP_CONFIG.maxPhotosPerTracker
    },
    createdAt: serverTimestamp || now,
    updatedAt: serverTimestamp || now,
    
    // Apply any customizations
    ...customizations
  };
} 