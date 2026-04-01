
import * as logger from "firebase-functions/logger";
import { OpenAIService } from "../openai.service";
import { GeminiImageService } from "./gemini-image.service";

export type ImageGenerationSource = 'openai' | 'gemini' | 'fallback';

export class ImageGenerationService {
	private openai: OpenAIService;
	private gemini: GeminiImageService;

	constructor(openaiApiKey: string) {
		this.openai = new OpenAIService(openaiApiKey);
		this.gemini = new GeminiImageService();
	}

	/**
	 * Unified image generation with smart fallback
	 */
	async generateUniversalImage(
		prompt: string,
		options: {
			userId: string,
			modelType?: 'standard' | 'pro',
			referenceImages?: string[],
			style?: 'realistic' | 'illustrated'
		}
	): Promise<{ imageUrl: string | null, source: ImageGenerationSource, model: string }> {
		const { modelType = 'standard', referenceImages = [], style = 'illustrated' } = options;

		logger.info(`Starting universal image generation for user ${options.userId}`, { modelType, hasReferences: referenceImages.length > 0 });

		// 1. Try OpenAI DALL-E 3 High Fidelity first (as it's usually preferred for quality)
		if (this.openai.isAvailable()) {
			try {
				const imageUrl = await this.openai.generateImage(prompt, referenceImages);
				if (imageUrl) {
					logger.info("UniversalImage: Successfully generated with OpenAI (High Fidelity)");
					return { imageUrl, source: 'openai', model: 'dall-e-3' };
				}
			} catch (error) {
				logger.error("UniversalImage: OpenAI failed, falling back to Gemini", error);
			}
		}

		// 2. Fallback to Gemini (Nano Banana)
		try {
			const geminiModel = modelType === 'pro' ? 'pro' : 'standard';
			const imageUrl = await this.gemini.generateImage(prompt, geminiModel, referenceImages);

			if (imageUrl) {
				logger.info(`UniversalImage: Successfully generated with Gemini (${geminiModel})`);
				return {
					imageUrl,
					source: 'gemini',
					model: geminiModel === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
				};
			}
		} catch (error) {
			logger.error("UniversalImage: Gemini also failed", error);
		}

		// 3. Final Fallback (static placeholder or null)
		logger.warn("UniversalImage: All AI generation failed");
		return { imageUrl: null, source: 'fallback', model: 'none' };
	}
}
