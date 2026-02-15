/* eslint-disable no-console */
const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

async function run() {
	console.log('--- Testing Nano Banana (Gemini 2.5 Flash Image via Vertex AI) ---');

	// Initialize Vertex AI with specific project and location
	const vertex_ai = new VertexAI({
		project: 'regen28-2fe51',
		location: 'us-central1'
	});

	// Model Name: gemini-2.5-flash-image (Nano Banana Standard)
	const modelName = 'gemini-2.5-flash-image';
	console.log(`Connecting to Model: ${modelName}`);

	const generativeModel = vertex_ai.getGenerativeModel({
		model: modelName,
		generationConfig: {
			maxOutputTokens: 2048,
			temperature: 0.4,
		}
	});

	const prompt = 'A futuristic eco-friendly city with flying green cars, digital art style';
	console.log(`Generating image for prompt: "${prompt}"...`);

	try {
		const req = {
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
		};

		const streamingResp = await generativeModel.generateContent(req);
		const result = await streamingResp.response;

		console.log('Response received.');

		if (result.candidates && result.candidates.length > 0) {
			const content = result.candidates[0].content;

			if (content.parts && content.parts.length > 0) {
				const firstPart = content.parts[0];

				if (firstPart.inlineData && firstPart.inlineData.data) {
					console.log('✅ Image data found (inlineData). Saving...');

					const buffer = Buffer.from(firstPart.inlineData.data, 'base64');
					const outputPath = path.join(__dirname, 'test-nano-vertex-output.png');
					fs.writeFileSync(outputPath, buffer);

					console.log(`Saved to: ${outputPath}`);
				} else {
					console.log('❌ No inline image data found in first part.');
					console.log('Content part:', JSON.stringify(firstPart, null, 2));
				}
			} else {
				console.log('❌ No parts in response content.');
			}
		} else {
			console.log('❌ No candidates returned.');
			console.log('Full Response:', JSON.stringify(result, null, 2));
		}

	} catch (error) {
		console.error('❌ Error during generation:', error);
		if (error.message && error.message.includes('404')) {
			console.log('\n--- TROUBLESHOOTING ---');
			console.log('1. The model name "gemini-2.5-flash-image" might not be available in "us-central1" yet.');
			console.log('2. Try checking available models for the project.');
		}
	}
}

run();
