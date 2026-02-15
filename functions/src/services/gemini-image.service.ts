import { GoogleGenAI } from "@google/genai";
import * as logger from "firebase-functions/logger";

// Vertex AI Configuration
const PROJECT_ID = process.env.GCLOUD_PROJECT || "regen28-2fe51";
const LOCATION = "global";

export class GeminiImageService {
	private ai: GoogleGenAI;

	constructor() {
		// Use Vertex AI auth — no API key needed in Cloud Functions
		this.ai = new GoogleGenAI({
			vertexai: true,
			project: PROJECT_ID,
			location: LOCATION,
		});
	}

	/**
	 * Generates an image using Nano Banana (Gemini) via Vertex AI.
	 * @param prompt The prompt for image generation.
	 * @param modelType 'standard' (gemini-2.5-flash-image) or 'pro' (gemini-3-pro-image-preview).
	 * @param referenceImages Optional array of reference images (buffer or data URL).
	 */
	async generateImage(
		prompt: string,
		modelType: 'standard' | 'pro' = 'standard',
		referenceImages?: (string | Buffer)[]
	): Promise<string | null> {
		try {
			// Model names for Nano Banana
			const targetModel = modelType === 'pro'
				? "gemini-3-pro-image-preview"   // Nano Banana Pro
				: "gemini-2.5-flash-image";       // Nano Banana Standard

			logger.info(`Nano Banana: Using model ${targetModel} (${modelType}) with ${referenceImages?.length || 0} references`);

			// Generation config — responseModalities is the key for image output
			const config: any = {
				maxOutputTokens: 2048,
				temperature: 0.9,
				responseModalities: ["TEXT", "IMAGE"],
				imageConfig: {
					aspectRatio: "1:1",
					imageSize: "1K",
					outputMimeType: "image/png",
				},
			};

			// Prepare parts
			const parts: any[] = [{ text: prompt }];

			// Add reference images if provided (Pro model specifically designed for this)
			if (referenceImages && referenceImages.length > 0) {
				for (const ref of referenceImages) {
					if (Buffer.isBuffer(ref)) {
						parts.push({
							inlineData: {
								mimeType: "image/jpeg",
								data: ref.toString('base64'),
							}
						});
					} else if (typeof ref === 'string') {
						const cleanBase64 = ref.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
						parts.push({
							inlineData: {
								mimeType: "image/jpeg",
								data: cleanBase64,
							}
						});
					}
				}
			}

			// Call Gemini via Vertex AI
			const response = await this.ai.models.generateContent({
				model: targetModel,
				contents: [{ role: "user", parts }],
				config,
			});

			// Extract image from response
			if (response.candidates && response.candidates.length > 0) {
				const responseParts = response.candidates[0].content?.parts || [];

				for (const part of responseParts) {
					// Check for inline data (image)
					if (part.inlineData?.data) {
						const base64 = part.inlineData.data;
						const mimeType = part.inlineData.mimeType || "image/png";
						return `data:${mimeType};base64,${base64}`;
					}
				}

				// If only text was returned, log it
				const textPart = responseParts.find((p: any) => p.text);
				if (textPart?.text) {
					logger.info("Nano Banana returned text instead of image:", textPart.text.substring(0, 100));
				}
			}

			return null;

		} catch (error) {
			logger.error("Error generating image with Nano Banana (Gemini):", error);
			return null;
		}
	}
}
