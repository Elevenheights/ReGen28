export type FeedItemType = 
  | 'activity' 
  | 'statCard' 
  | 'guidance' 
  | 'journal' 
  | 'progressPhoto' 
  | 'aiSelf' 
  | 'wrappedVideo' 
  | 'milestone'
  | 'trackerEntry'
  | 'inspiration'
  | 'action'
  | 'insight';

export type FeedItemSourceKind = 'activity' | 'statSnapshot' | 'manual' | 'ai-generated';

export type MediaStatus = 'none' | 'queued' | 'generating' | 'ready' | 'failed';

export type MediaKind = 'card' | 'progress' | 'ai';

export interface FeedItemMetric {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string | number; // e.g. "+5%" or 1
  deltaType?: 'positive' | 'negative' | 'neutral'; // For coloring
}

export interface FeedMediaImage {
  url: string;
  width?: number;
  height?: number;
  kind: MediaKind;
  path?: string; // Storage path for cleanup
}

export interface FeedMediaVideo {
  url: string;
  durationSec?: number;
  thumbnailUrl?: string;
  path?: string; // Storage path
  thumbnailPath?: string; // Storage path
}

export interface FeedAIMetadata {
  kind: 'caption' | 'image' | 'video';
  provider: 'vertex' | 'openai';
  model: string;
  promptTemplateId?: string;
  generatedAt: any; // Timestamp
}

export interface FeedConsent {
  aiLikenessAllowed: boolean;
  aiLikenessAt?: any; // Timestamp
  aiLikenessVersion?: string;
}

export interface FeedItem {
  id?: string;
  userId: string;
  type: FeedItemType;
  
  // Content
  title: string; // Used as the main "caption" header or ignored in IG style
  subtitle?: string; // Secondary text
  body?: string; // The main caption text
  
  // Source tracking
  source: {
    kind: FeedItemSourceKind;
    id?: string; // ID of the original activity, journal entry, etc.
    trackerId?: string; // For action/insight posts
    trackerName?: string; // For display purposes
  };
  
  // Additional metadata for action/insight posts
  metadata?: {
    icon?: string;
    reason?: string;
    insightType?: string;
    dataPoint?: string;
    trackerCategory?: string;
  };
  
  // Date key for querying posts by day
  dateKey?: string;
  
  // Metrics to display (rendered inside the post content)
  metrics?: FeedItemMetric[];
  
  // Organization
  tags?: string[];
  visibility: 'private' | 'shareable';
  
  // Media
  media?: {
    status: MediaStatus;
    images?: FeedMediaImage[];
    video?: FeedMediaVideo | null;
    storagePaths?: string[]; // All associated paths for cleanup
  };
  
  // AI Metadata (if applicable)
  ai?: FeedAIMetadata;
  
  // Consent tracking (if applicable)
  consent?: FeedConsent;
  
  // Timestamps
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  
  // UI State (not persisted)
  isHidden?: boolean;
  
  // Author information (Top left of post)
  author?: {
    name: string;
    avatarUrl?: string;
    isAiGenerated?: boolean;
    location?: string; // "At Gym", "Mindfulness Zone"
  };

  // Social interactions
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
}

export interface FeedComment {
  id: string;
  feedItemId: string;
  userId: string;
  text: string;
  createdAt: string | Date;
  author?: {
    name: string;
    avatarUrl?: string;
  };
}
