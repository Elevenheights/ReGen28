/**
 * Cloud Functions for ReGen28
 * - AI Recommendations for tracker suggestions
 * - User Management for onboarding and analytics
 */

import {initializeApp} from "firebase-admin/app";
initializeApp();

import {setGlobalOptions} from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {getFirestore} from "firebase-admin/firestore";
import {OpenAIService} from "./openai.service";
import {completeUserOnboarding, updateUserStats, cleanupDuplicateTrackers, cleanupOldSuggestions, getTrackerSpecificSuggestions, onTrackerEntryCreated, checkExpiredTrackers, queueDailyTrackerSuggestions, processSuggestionJobs, onSuggestionJobCreated, updateUserSubscriptionStatus, checkExpiredTrials, getDailyJournalPrompt, getReflectionPrompts, queueDailyJournalPrompts, processJournalPromptJobs} from './user-management';
import {calculateAllDailyStats, getUserDailyStats as getUserDailyStatsFunction, getTrackerDailyStats as getTrackerDailyStatsFunction, getJournalDailyStats as getJournalDailyStatsFunction, getWeeklyMoodTrend, getPerformanceInsights, triggerStatsCalculation, backfillUserStats, onTrackerEntryCreated as onTrackerEntryCreatedStats, onJournalEntryWritten, onActivityCreated} from './statistics-functions';

const db = getFirestore();

// Export all functions
export {
  completeUserOnboarding,
  updateUserStats,
  cleanupDuplicateTrackers,
  cleanupOldSuggestions,
  getTrackerSpecificSuggestions,
  onTrackerEntryCreated,
  checkExpiredTrackers,
  queueDailyTrackerSuggestions,
  processSuggestionJobs,
  onSuggestionJobCreated,
  updateUserSubscriptionStatus,
  checkExpiredTrials,
  getDailyJournalPrompt,
  getReflectionPrompts,
  queueDailyJournalPrompts,
  processJournalPromptJobs,
  // Statistics functions
  calculateAllDailyStats,
  getUserDailyStatsFunction,
  getTrackerDailyStatsFunction,
  getJournalDailyStatsFunction,
  getWeeklyMoodTrend,
  getPerformanceInsights,
  triggerStatsCalculation,
  backfillUserStats,
  onTrackerEntryCreatedStats,
  onJournalEntryWritten,
  onActivityCreated
};

// Define the OpenAI API key secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Set global options for cost control
setGlobalOptions({
  maxInstances: 10
});

// Available activities data
const AVAILABLE_TRACKERS = [
  // MIND - Mental wellness and cognitive development
  {
    id: "meditation",
    name: "Meditation",
    category: "MIND",
    icon: "🧘",
    target: 10,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "reading",
    name: "Reading",
    category: "MIND",
    icon: "📚",
    target: 20,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "journaling",
    name: "Journaling",
    category: "MIND",
    icon: "📝",
    target: 1,
    unit: "entry",
    frequency: "daily",
  },
  {
    id: "learning",
    name: "Learning/Study",
    category: "MIND",
    icon: "🎓",
    target: 2,
    unit: "hours",
    frequency: "weekly",
  },
  {
    id: "creative-time",
    name: "Creative Activity",
    category: "MIND",
    icon: "🎨",
    target: 20,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "mindfulness",
    name: "Mindful Breathing",
    category: "MIND",
    icon: "🌬️",
    target: 5,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "focus-session",
    name: "Deep Focus Work",
    category: "MIND",
    icon: "🎯",
    target: 25,
    unit: "minutes",
    frequency: "daily",
  },

  // BODY - Physical health and fitness
  {
    id: "exercise",
    name: "Exercise",
    category: "BODY",
    icon: "💪",
    target: 4,
    unit: "sessions",
    frequency: "weekly",
  },
  {
    id: "water-intake",
    name: "Water Intake",
    category: "BODY",
    icon: "💧",
    target: 8,
    unit: "glasses",
    frequency: "daily",
  },
  {
    id: "sleep",
    name: "Sleep Quality",
    category: "BODY",
    icon: "😴",
    target: 8,
    unit: "hours",
    frequency: "daily",
  },
  {
    id: "stretching",
    name: "Stretching",
    category: "BODY",
    icon: "🤸",
    target: 15,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "steps",
    name: "Daily Steps",
    category: "BODY",
    icon: "👟",
    target: 10000,
    unit: "steps",
    frequency: "daily",
  },
  {
    id: "yoga",
    name: "Yoga Practice",
    category: "BODY",
    icon: "🧘‍♀️",
    target: 3,
    unit: "sessions",
    frequency: "weekly",
  },
  {
    id: "healthy-meals",
    name: "Healthy Meals",
    category: "BODY",
    icon: "🥗",
    target: 5,
    unit: "meals",
    frequency: "weekly",
  },
  {
    id: "posture-check",
    name: "Posture Check",
    category: "BODY",
    icon: "🏃‍♂️",
    target: 5,
    unit: "checks",
    frequency: "daily",
  },
  {
    id: "outdoor-time",
    name: "Time Outdoors",
    category: "BODY",
    icon: "🌳",
    target: 30,
    unit: "minutes",
    frequency: "daily",
  },

  // SOUL - Emotional and spiritual wellness
  {
    id: "gratitude",
    name: "Gratitude Practice",
    category: "SOUL",
    icon: "🙏",
    target: 1,
    unit: "entry",
    frequency: "daily",
  },
  {
    id: "mood",
    name: "Daily Mood",
    category: "SOUL",
    icon: "😊",
    target: 1,
    unit: "check-in",
    frequency: "daily",
  },
  {
    id: "social-connection",
    name: "Social Connection",
    category: "SOUL",
    icon: "👥",
    target: 3,
    unit: "interactions",
    frequency: "weekly",
  },
  {
    id: "acts-of-kindness",
    name: "Acts of Kindness",
    category: "SOUL",
    icon: "💝",
    target: 2,
    unit: "acts",
    frequency: "weekly",
  },
  {
    id: "prayer-reflection",
    name: "Prayer/Reflection",
    category: "SOUL",
    icon: "🕊️",
    target: 10,
    unit: "minutes",
    frequency: "daily",
  },
  {
    id: "nature-connection",
    name: "Nature Connection",
    category: "SOUL",
    icon: "🌿",
    target: 1,
    unit: "hour",
    frequency: "weekly",
  },
  {
    id: "digital-detox",
    name: "Digital Detox",
    category: "SOUL",
    icon: "📵",
    target: 1,
    unit: "hour",
    frequency: "daily",
  },
  {
    id: "affirmations",
    name: "Positive Affirmations",
    category: "SOUL",
    icon: "💭",
    target: 5,
    unit: "affirmations",
    frequency: "daily",
  },

  // BEAUTY - Self-care and personal grooming
  {
    id: "skincare",
    name: "Skincare Routine",
    category: "BEAUTY",
    icon: "✨",
    target: 1,
    unit: "routine",
    frequency: "daily",
  },
  {
    id: "self-care",
    name: "Self-Care Time",
    category: "BEAUTY",
    icon: "🛁",
    target: 2,
    unit: "hours",
    frequency: "weekly",
  },
  {
    id: "hair-care",
    name: "Hair Care",
    category: "BEAUTY",
    icon: "💇‍♀️",
    target: 1,
    unit: "routine",
    frequency: "weekly",
  },
  {
    id: "nail-care",
    name: "Nail Care",
    category: "BEAUTY",
    icon: "💅",
    target: 1,
    unit: "session",
    frequency: "weekly",
  },
  {
    id: "outfit-planning",
    name: "Outfit Planning",
    category: "BEAUTY",
    icon: "👗",
    target: 7,
    unit: "outfits",
    frequency: "weekly",
  },
  {
    id: "mirror-work",
    name: "Mirror Affirmations",
    category: "BEAUTY",
    icon: "🪞",
    target: 5,
    unit: "minutes",
    frequency: "daily",
  },
  
  // LIFESTYLE - Habits and life management
  {
    id: "budget-tracking",
    name: "Budget Tracking",
    category: "LIFESTYLE",
    icon: "💰",
    target: 7,
    unit: "days on budget",
    frequency: "weekly",
  },
  {
    id: "spending-check",
    name: "Spending Check-in",
    category: "LIFESTYLE",
    icon: "🧾",
    target: 1,
    unit: "review",
    frequency: "daily",
  },
];

interface RecommendationRequest {
  focusAreas: string[];
  goals: string[];
  commitmentLevel: "light" | "moderate" | "intensive";
}

/**
 * AI-powered tracker recommendations function
 * @param {RecommendationRequest} request - The request data
 * @return {Promise<object>} The recommendations response
 */
export const getTrackerRecommendations = onCall<RecommendationRequest>(
  {
    maxInstances: 5,
    secrets: [openaiApiKey],
    invoker: 'public',
  },
  async (request) => {
    try {
      const {focusAreas, goals, commitmentLevel} = request.data;

      logger.info("AI Recommendations requested", {
        focusAreas,
        goals,
        commitmentLevel,
        structuredData: true,
      });

      // Validate input
      if (!focusAreas || !Array.isArray(focusAreas) || !goals || !Array.isArray(goals) || !commitmentLevel) {
        throw new Error(
          "Missing required parameters: focusAreas, goals, or commitmentLevel"
        );
      }

      // Filter trackers based on focus areas, but be more inclusive
      let relevantTrackers = AVAILABLE_TRACKERS.filter((tracker) => {
        // Always include LIFESTYLE trackers as they can be relevant to any focus area
        if (tracker.category === 'LIFESTYLE') return true;
        
        // Include trackers that match selected focus areas
        return focusAreas.some((area) =>
          area.toUpperCase() === tracker.category.toUpperCase()
        );
      });

      // If no relevant trackers found, include all trackers
      if (relevantTrackers.length === 0) {
        logger.warn("No relevant trackers found, including all trackers");
        relevantTrackers = AVAILABLE_TRACKERS;
      }

      logger.info("Relevant trackers found", {
        count: relevantTrackers.length,
        categories: [...new Set(relevantTrackers.map(t => t.category))]
      });

      // Try AI recommendations - no fallbacks
      const openaiService = new OpenAIService(openaiApiKey.value());
      
      if (!openaiService.isAvailable()) {
        throw new Error("OpenAI service not available");
      }

      return await openaiService.getRecommendations(
        focusAreas,
        goals,
        commitmentLevel,
        relevantTrackers
      );
    } catch (error) {
      logger.error("Error generating recommendations", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestData: request.data
      });
      
      // Re-throw the error instead of using fallbacks
      throw error;
    }
  }
);

interface LogTrackerEntryRequest {
  trackerId: string;
  userId: string;
  date: string;
  value: number;
  mood?: number;
  energy?: number;
  notes?: string;
  duration?: number;
  intensity?: number;
  quality?: number;
  tags?: string[];
  socialContext?: 'alone' | 'with-others' | 'group';
}

/**
 * Log a new tracker entry with proper validation and error handling
 * @param {LogTrackerEntryRequest} request - The tracker entry data
 * @return {Promise<{entryId: string}>} The created entry ID
 */
export const logTrackerEntry = onCall<LogTrackerEntryRequest>(
  {
    invoker: 'public',
  },
  async (request) => {
    try {
      const {
        trackerId,
        userId,
        date,
        value,
        mood,
        energy,
        notes,
        duration,
        intensity,
        quality,
        tags,
        socialContext
      } = request.data;

      logger.info("Logging tracker entry", {
        trackerId,
        userId,
        date,
        value,
        structuredData: true,
      });

      // Validate required fields
      if (!trackerId || !userId || !date || value === undefined || value === null) {
        throw new Error("Missing required fields: trackerId, userId, date, or value");
      }

      // Verify that the tracker exists and belongs to the user
      const trackerDoc = await db.collection('trackers').doc(trackerId).get();
      if (!trackerDoc.exists) {
        throw new Error("Tracker not found");
      }

      const trackerData = trackerDoc.data();
      if (trackerData?.userId !== userId) {
        throw new Error("Tracker does not belong to this user");
      }

      // Create the tracker entry
      const entryData = {
        trackerId,
        userId,
        date,
        value,
        ...(mood !== undefined && {mood}),
        ...(energy !== undefined && {energy}),
        ...(notes && {notes}),
        ...(duration !== undefined && {duration}),
        ...(intensity !== undefined && {intensity}),
        ...(quality !== undefined && {quality}),
        ...(tags && tags.length > 0 && {tags}),
        ...(socialContext && {socialContext}),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add the entry to Firestore
      const entryRef = await db.collection('tracker-entries').add(entryData);

      logger.info("Tracker entry created successfully", {
        entryId: entryRef.id,
        trackerId,
        userId,
        structuredData: true,
      });

      return {
        entryId: entryRef.id
      };

    } catch (error) {
      logger.error("Error logging tracker entry", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestData: request.data
      });

      throw new Error(`Failed to log tracker entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// NOTE: getTrackerEntryCount function removed - now using computed entryCount field in tracker documents
// This eliminates expensive count() queries and reduces billing costs
