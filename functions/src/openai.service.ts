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
			logger.error("OpenAI API error", { error });
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
	async callOpenAI(prompt: string, jsonMode: boolean = true): Promise<any> {
		if (!this.openai) {
			throw new Error("OpenAI client not initialized");
		}

		const completion = await this.openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{
					role: "system",
					content: "You are a wellness expert/coach providing personalized " +
						"habit tracker recommendations and motivation. " + (jsonMode ? "Always respond with valid JSON." : ""),
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 1500,
			temperature: 0.7,
			response_format: jsonMode ? { type: "json_object" } : undefined,
		});

		const responseText = completion.choices[0]?.message?.content;
		if (!responseText) {
			throw new Error("Empty response from OpenAI");
		}

		if (jsonMode) {
			try {
				return JSON.parse(responseText);
			} catch (e) {
				logger.error("Failed to parse JSON response from OpenAI", { responseText });
				// Fallback: try to clean and parse
				const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
				return JSON.parse(cleanJson);
			}
		}

		return responseText;
	}

	/**
	 * Generate an image using GPT Image 1.5 (latest high-fidelity model)
	 * Supports 'input_fidelity: high' for reference image preservation.
	 */
	async generateImage(prompt: string, referenceImages?: (string | Buffer)[]): Promise<string | null> {
		if (!this.openai) {
			throw new Error("OpenAI service not initialized");
		}

		try {
			logger.info("OpenAI: Generating high-fidelity image with gpt-image-1.5", {
				promptLength: prompt.length,
				refCount: referenceImages?.length || 0
			});

			// 1. If we have reference images, use images.edit for native likeness preservation
			if (referenceImages && referenceImages.length > 0) {
				const files = await Promise.all(referenceImages.slice(0, 5).map(async (ref, index) => {
					if (Buffer.isBuffer(ref)) {
						return OpenAI.toFile(ref, `reference_${index}.jpg`, { type: 'image/jpeg' });
					} else {
						// Handle base64 or URL
						const cleanBase64 = ref.replace(/^data:image\/\w+;base64,/, "");
						const buffer = Buffer.from(cleanBase64, 'base64');
						return OpenAI.toFile(buffer, `reference_${index}.jpg`, { type: 'image/jpeg' });
					}
				}));

				logger.info(`OpenAI: Using images.edit for gpt-image-1.5 with ${files.length} references`);

				// @ts-ignore - 'image' can be an array for gpt-image-1.5
				const response = await this.openai.images.edit({
					model: "gpt-image-1.5",
					image: files,
					prompt: prompt,
					input_fidelity: "high", // Critical for preservation
					response_format: "url"
				});

				const imageUrl = response.data?.[0]?.url;
				return imageUrl || null;
			}

			// 2. Otherwise use standard generation
			logger.info(`OpenAI: Using images.generate for gpt-image-1.5 (vivid)`);
			const response = await this.openai.images.generate({
				model: "gpt-image-1.5",
				prompt: prompt,
				n: 1,
				size: "1024x1024",
				quality: "hd",
				style: "vivid",
				response_format: "url"
			});

			return response.data?.[0]?.url || null;
		} catch (error) {
			logger.error("Error generating image with OpenAI gpt-image-1.5:", error);
			if (error instanceof OpenAI.APIError) {
				logger.error("OpenAI API Error Details:", {
					status: error.status,
					code: error.code,
					message: error.message
				});
			}
			return null;
		}
	}

	/**
	 * Parse OpenAI response
	 */
	private parseResponse(aiRecommendations: any, relevantTrackers: any[]): AIRecommendationResponse {
		try {
			const recommendations: TrackerRecommendation[] = aiRecommendations.recommendations
				.map((rec: any) => {
					const cleanTrackerName = rec.trackerName.replace(/\s*\([^)]*\)\s*$/, '').trim();
					let tracker = relevantTrackers.find((t) => t.name === cleanTrackerName);

					if (!tracker) {
						tracker = relevantTrackers.find((t) =>
							t.name.toLowerCase().includes(cleanTrackerName.toLowerCase()) ||
							cleanTrackerName.toLowerCase().includes(t.name.toLowerCase())
						);
					}

					if (!tracker) {
						const keywords = cleanTrackerName.toLowerCase().split(' ');
						tracker = relevantTrackers.find((t) =>
							keywords.some((keyword: string) => t.name.toLowerCase().includes(keyword))
						);
					}

					if (!tracker) return null;

					return {
						trackerId: tracker.id,
						reason: rec.reason,
						priority: rec.priority || 5,
						customTarget: rec.customTarget,
					};
				})
				.filter(Boolean)
				.slice(0, 8);

			return {
				recommendations,
				source: "ai",
				model: "gpt-4o",
			};
		} catch (parseError) {
			logger.error("Failed to parse AI response", { parseError });
			throw new Error("Invalid AI response format");
		}
	}
}
