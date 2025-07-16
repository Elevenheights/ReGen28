import OpenAI from "openai";
import * as logger from "firebase-functions/logger";

interface TrackerRecommendation {
  trackerId: string;
  reason: string;
  priority: number;
  customTarget?: number;
}

interface AIRecommendationResponse {
  recommendations: TrackerRecommendation[];
  source: "ai" | "fallback";
  model: string;
}

export class OpenAIService {
  private openai: OpenAI | undefined;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    // Use provided API key or fallback to environment variable
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
      logger.info("OpenAI service initialized successfully");
    } else {
      logger.warn("OPENAI_API_KEY not provided and environment variable not found");
    }
  }

  /**
   * Check if OpenAI is available
   */
  isAvailable(): boolean {
    return !!this.apiKey && !!this.openai;
  }

  /**
   * Generate tracker recommendations using OpenAI
   */
  async getRecommendations(
    focusAreas: string[],
    goals: string[],
    commitmentLevel: string,
    relevantTrackers: any[]
  ): Promise<AIRecommendationResponse> {
    if (!this.openai) {
      throw new Error("OpenAI service not initialized");
    }

    try {
      const prompt = this.createPrompt(focusAreas, goals, commitmentLevel, relevantTrackers);
      const response = await this.callOpenAI(prompt);
      return this.parseResponse(response, relevantTrackers);
    } catch (error) {
      logger.error("OpenAI API error", {error});
      throw error;
    }
  }

  /**
   * Create the AI prompt
   */
  private createPrompt(
    focusAreas: string[],
    goals: string[],
    commitmentLevel: string,
    relevantTrackers: any[]
  ): string {
    return `
As a wellness expert, recommend the best habit trackers for a user with these goals and preferences:

Focus Areas: ${focusAreas.join(", ")}
Goals: ${goals.join(", ")}
Commitment Level: ${commitmentLevel} (light=10-15min daily, moderate=20-30min daily, intensive=30+min daily)

Available Trackers:
${relevantTrackers.map((t) => `- ${t.name} (${t.category}): ${t.target} ${t.unit} ${t.frequency}`).join("\n")}

Please recommend 5-8 trackers that best align with their goals. For each recommendation, provide:
1. Tracker name (exactly as listed above)
2. Brief reason why it fits their goals
3. Priority (1-10, where 10 is highest priority)
4. Optional: Custom target if different from default

Format your response as JSON:
{
  "recommendations": [
    {
      "trackerName": "exact tracker name",
      "reason": "why this tracker helps with their specific goals",
      "priority": number,
      "customTarget": optional number
    }
  ]
}
`;
  }



  /**
   * Call OpenAI API - public method for all OpenAI text generation
   */
  async callOpenAI(prompt: string): Promise<any> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a wellness exper/coach providing personalized " +
            "habit tracker recommendations and motivation. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 1,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    return responseText;
  }

  /**
   * Parse OpenAI response
   */
  private parseResponse(responseText: string, relevantTrackers: any[]): AIRecommendationResponse {
    try {
      // Clean up potential markdown formatting
      let cleanedResponse = responseText.trim();
      
      // Remove markdown code block markers if present
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/, '');
        cleanedResponse = cleanedResponse.replace(/\s*```\s*$/, '');
      }
      
      // Remove any leading/trailing whitespace after cleaning
      cleanedResponse = cleanedResponse.trim();
      
      const aiRecommendations = JSON.parse(cleanedResponse);

      const recommendations: TrackerRecommendation[] = aiRecommendations.recommendations
        .map((rec: any) => {
          // Clean up tracker name - remove category suffixes like "(SOUL)"
          const cleanTrackerName = rec.trackerName.replace(/\s*\([^)]*\)\s*$/, '').trim();
          
          // Try to find tracker by exact name match first
          let tracker = relevantTrackers.find((t) => t.name === cleanTrackerName);
          
          // If not found, try fuzzy matching
          if (!tracker) {
            tracker = relevantTrackers.find((t) => 
              t.name.toLowerCase().includes(cleanTrackerName.toLowerCase()) ||
              cleanTrackerName.toLowerCase().includes(t.name.toLowerCase())
            );
          }
          
          // If still not found, try matching by keywords
          if (!tracker) {
            const keywords = cleanTrackerName.toLowerCase().split(' ');
            tracker = relevantTrackers.find((t) => 
              keywords.some((keyword: string) => t.name.toLowerCase().includes(keyword))
            );
          }
          
          if (!tracker) {
            logger.warn("Tracker not found for AI recommendation", {
              originalName: rec.trackerName,
              cleanedName: cleanTrackerName,
              availableTrackers: relevantTrackers.map(t => t.name)
            });
            return null;
          }

          return {
            trackerId: tracker.id,
            reason: rec.reason,
            priority: rec.priority || 5,
            customTarget: rec.customTarget,
          };
        })
        .filter(Boolean)
        .slice(0, 8);

      logger.info("AI recommendations generated", {
        count: recommendations.length,
        trackers: recommendations.map((r) => r.trackerId),
      });

      return {
        recommendations,
        source: "ai",
        model: "gpt-4o",
      };
    } catch (parseError) {
      logger.error("Failed to parse AI response", {responseText, parseError});
      throw new Error("Invalid AI response format");
    }
  }
} 