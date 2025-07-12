import { Tracker } from '../models/tracker.interface';
import { ConfigService } from '../services/config.service';

// Re-export for backward compatibility
export { DefaultTrackerTemplate } from '../services/config.service';

// Use centralized config service for templates
const configService = new ConfigService();
export const DEFAULT_TRACKER_TEMPLATES = configService.getDefaultTrackerTemplates();


/**
 * @deprecated Use ConfigService.createTrackerFromTemplate instead
 * Quick Setup Function - maintained for backward compatibility
 */
export function createDefaultTrackersForUser(userId: string): Partial<Tracker>[] {
  return DEFAULT_TRACKER_TEMPLATES.map(template => {
    const tracker = configService.createTrackerFromTemplate(template.id, userId);
    return tracker ? { ...tracker, id: undefined } : null;
  }).filter(tracker => tracker !== null) as Partial<Tracker>[];
} 