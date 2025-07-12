/**
 * Cloud Functions for ReGen28
 * - AI Recommendations for tracker suggestions
 * - User Management for onboarding and analytics
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {OpenAIService} from "./openai.service";
import {completeUserOnboarding, updateUserStats, cleanupDuplicateTrackers, getDailySuggestions, cleanupOldSuggestions, onTrackerEntryCreated, checkExpiredTrackers} from './user-management';

// Initialize Firebase Admin (main entry point)
initializeApp();
const db = getFirestore();

// Export all functions
export {
  completeUserOnboarding,
  updateUserStats,
  cleanupDuplicateTrackers,
  getDailySuggestions,
  cleanupOldSuggestions,
  onTrackerEntryCreated,
  checkExpiredTrackers
};

// Define the OpenAI API key secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Set global options for cost control
setGlobalOptions({maxInstances: 10});

// Available trackers data
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

interface TrackerRecommendation {
  trackerId: string;
  reason: string;
  priority: number;
  customTarget?: number;
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

      // Try AI recommendations first
      const openaiService = new OpenAIService(openaiApiKey.value());
      
      if (openaiService.isAvailable()) {
        try {
          return await openaiService.getRecommendations(
            focusAreas,
            goals,
            commitmentLevel,
            relevantTrackers
          );
        } catch (error) {
          logger.warn("OpenAI failed, falling back to rule-based", {error});
        }
      } else {
        logger.warn("OpenAI API key not found, using fallback");
      }

      // Fallback to rule-based recommendations
      return generateFallbackRecommendations(
        relevantTrackers,
        goals,
        commitmentLevel
      );
    } catch (error) {
      logger.error("Error generating recommendations", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestData: request.data
      });
      
      // Final fallback - be very defensive
      try {
        const fallbackFocusAreas = Array.isArray(request.data?.focusAreas) ? request.data.focusAreas : [];
        const fallbackGoals = Array.isArray(request.data?.goals) ? request.data.goals : [];
        const fallbackCommitment = request.data?.commitmentLevel || 'moderate';

        const relevantTrackers = AVAILABLE_TRACKERS.filter((tracker) => {
          // Always include LIFESTYLE trackers
          if (tracker.category === 'LIFESTYLE') return true;
          
          // If no focus areas, include all trackers
          if (fallbackFocusAreas.length === 0) return true;
          
          // Include trackers matching focus areas
          return fallbackFocusAreas.some((area: string) =>
            String(area).toUpperCase() === tracker.category.toUpperCase()
          );
        });

        return generateFallbackRecommendations(
          relevantTrackers,
          fallbackGoals,
          fallbackCommitment
        );
      } catch (fallbackError) {
        logger.error("Final fallback failed", {fallbackError});
        
        // Emergency response
        return {
          recommendations: [
            {trackerId: 'mood', reason: 'Essential for tracking wellness', priority: 10},
            {trackerId: 'sleep', reason: 'Fundamental for health', priority: 9},
            {trackerId: 'exercise', reason: 'Important for physical wellness', priority: 8}
          ],
          source: 'emergency',
          model: 'hardcoded'
        };
      }
    }
  }
);

/**
 * Fallback recommendation logic when AI is unavailable
 * @param {typeof AVAILABLE_TRACKERS} relevantTrackers - Available trackers
 * @param {string[]} goals - User goals
 * @param {string} commitmentLevel - User commitment level
 * @return {object} Fallback recommendations
 */
function generateFallbackRecommendations(
  relevantTrackers: typeof AVAILABLE_TRACKERS,
  goals: string[],
  commitmentLevel: string
): any {
  const recommendations: TrackerRecommendation[] = [];

  // Goal-based scoring
  const goalKeywords = goals.join(" ").toLowerCase();

  // Score trackers based on goal relevance
  const scoredTrackers = relevantTrackers.map((tracker) => {
    let score = 3; // Base score

    // Boost score based on goal keywords
    if (goalKeywords.includes("stress") || goalKeywords.includes("anxiety")) {
      if (["meditation", "mindfulness", "gratitude", "mood"].includes(tracker.id)) {
        score += 3;
      }
    }

    if (goalKeywords.includes("health") || goalKeywords.includes("fitness")) {
      if (["exercise", "steps", "water-intake", "sleep"].includes(tracker.id)) {
        score += 3;
      }
    }

    if (goalKeywords.includes("energy")) {
      if (["sleep", "exercise", "water-intake", "healthy-meals"].includes(tracker.id)) {
        score += 2;
      }
    }

    if (goalKeywords.includes("focus") || goalKeywords.includes("clarity")) {
      if (["meditation", "focus-session", "reading", "digital-detox"].includes(tracker.id)) {
        score += 3;
      }
    }

    if (goalKeywords.includes("confidence") || goalKeywords.includes("self-care")) {
      if (["affirmations", "mirror-work", "self-care", "skincare"].includes(tracker.id)) {
        score += 2;
      }
    }

    if (goalKeywords.includes("spiritual") || goalKeywords.includes("growth")) {
      if (["prayer-reflection", "gratitude", "nature-connection"].includes(tracker.id)) {
        score += 2;
      }
    }

    if (goalKeywords.includes("relationships") || goalKeywords.includes("social")) {
      if (["social-connection", "acts-of-kindness", "digital-detox"].includes(tracker.id)) {
        score += 2;
      }
    }

    if (goalKeywords.includes("spending") || goalKeywords.includes("budget") || goalKeywords.includes("financial")) {
      if (["budget-tracking", "spending-check"].includes(tracker.id)) {
        score += 3;
      }
    }

    if (goalKeywords.includes("read") || goalKeywords.includes("reading") || goalKeywords.includes("books")) {
      if (tracker.id === "reading") {
        score += 3;
      }
    }

    // Always recommend mood tracking
    if (tracker.id === "mood") score += 2;

    return {...tracker, score};
  });

  // Sort by score and take top recommendations
  const topTrackers = scoredTrackers
    .sort((a, b) => b.score - a.score)
    .slice(0, commitmentLevel === "light" ? 5 : commitmentLevel === "moderate" ? 6 : 8);

  // Convert to recommendation format
  topTrackers.forEach((tracker, index) => {
    let reason = `Great for your ${tracker.category.toLowerCase()} focus area`;

    if (goalKeywords.includes("stress") && ["meditation", "mindfulness"].includes(tracker.id)) {
      reason = "Proven to reduce stress and promote mental clarity";
    } else if (goalKeywords.includes("health") && ["exercise", "water-intake"].includes(tracker.id)) {
      reason = "Essential for physical health and energy levels";
    } else if (goalKeywords.includes("spending") && ["budget-tracking", "spending-check"].includes(tracker.id)) {
      reason = "Helps build financial awareness and control spending habits";
    } else if (goalKeywords.includes("read") && tracker.id === "reading") {
      reason = "Regular reading improves knowledge, focus, and mental stimulation";
    } else if (tracker.id === "mood") {
      reason = "Daily mood tracking helps identify patterns and triggers";
    }

    recommendations.push({
      trackerId: tracker.id,
      reason,
      priority: 10 - index,
      customTarget: undefined,
    });
  });

  logger.info("Fallback recommendations generated", {
    count: recommendations.length,
    trackers: recommendations.map((r) => r.trackerId),
  });

  return {
    recommendations,
    source: "fallback",
    model: "rule-based",
  };
}

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
    maxInstances: 10,
    cors: true, // Enable CORS for web requests
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
