/* eslint-disable no-console */
const { GeminiImageService } = require('./lib/services/gemini-image.service');
const fs = require('fs');
const path = require('path');

async function run() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('Error: GEMINI_API_KEY environment variable is not set.');
		console.error('Usage (PowerShell): $env:GEMINI_API_KEY="your-key"; node functions/test-gemini.js');
		process.exit(1);
	}

	console.log('--- Testing Nano Banana (Gemini Image Service) ---');
	const service = new GeminiImageService(apiKey);

	const prompt = 'A futuristic eco-friendly city with flying green cars, digital art style';
	console.log(`Generating image for prompt: "${prompt}"...`);

	try {
		const result = await service.generateImage(prompt, 'standard');

		if (result) {
			console.log('Generation successful! Saving image...');

			// Remove data URL prefix if present
			const base64Data = result.replace(/^data:image\/\w+;base64,/, "");
			const buffer = Buffer.from(base64Data, 'base64');

			const outputPath = path.join(__dirname, 'test-output.png');
			fs.writeFileSync(outputPath, buffer);

			console.log(`Image saved to: ${outputPath}`);
		} else {
			console.error('Generation failed: No result returned.');
		}
	} catch (error) {
		console.error('Error during generation:', error);
	}
}

run();
