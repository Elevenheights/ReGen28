/* eslint-disable no-console */
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ID = 'regen28-2fe51';
const LOCATION = 'global';

// Nano Banana Model Names
const STANDARD_MODEL = 'gemini-2.5-flash-image';       // Nano Banana Standard
const PRO_MODEL = 'gemini-3-pro-image-preview';          // Nano Banana Pro

// Initialize with Vertex AI auth (no API key needed — uses gcloud credentials)
const ai = new GoogleGenAI({
	vertexai: true,
	project: PROJECT_ID,
	location: LOCATION,
});

// Generation config (from Google's own code example)
const generationConfig = {
	maxOutputTokens: 2048,
	temperature: 0.9,
	responseModalities: ["TEXT", "IMAGE"],  // THIS is the key config for image output!
	imageConfig: {
		aspectRatio: "1:1",
		imageSize: "1K",
		outputMimeType: "image/png",
	},
};

async function runTests() {
	console.log('=== Testing Nano Banana (@google/genai + Vertex AI Auth) ===');
	console.log(`Project: ${PROJECT_ID}`);
	console.log(`Location: ${LOCATION}`);

	// Test 1: Standard Generation (No Reference)
	// console.log('\n--- Test 1: Standard (gemini-2.5-flash-image) — No Reference Image ---');
	// await generateImage(STANDARD_MODEL, 'A futuristic eco-city park with glowing trees', 'test-standard.png');

	// Test 2: Standard with Reference Image
	console.log('\n--- Test 2: Standard (gemini-2.5-flash-image) — With Reference Image ---');

	// Generate a real test image (100x100 blue square) using sharp
	const sharp = require('sharp');
	const testImageBuffer = await sharp({
		create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 100, b: 200 } }
	}).png().toBuffer();
	const referenceBase64 = testImageBuffer.toString('base64');
	console.log(`Generated test reference image: ${testImageBuffer.length} bytes`);

	await generateImageWithReference(
		STANDARD_MODEL,
		'A character in a cyberpunk setting, stylized portrait',
		referenceBase64,
		'test-standard-reference.png'
	);
}

async function generateImage(modelName, prompt, filename) {
	try {
		console.log(`Model: ${modelName}`);
		console.log(`Prompt: "${prompt}"`);

		const response = await ai.models.generateContent({
			model: modelName,
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			config: generationConfig,
		});

		saveResponse(response, filename);
	} catch (error) {
		console.error(`❌ Test Failed: ${error.message}`);
	}
}

async function generateImageWithReference(modelName, prompt, referenceBase64, filename) {
	try {
		console.log(`Model: ${modelName}`);
		console.log(`Prompt: "${prompt}"`);
		console.log(`Reference Image: [Base64 provided]`);

		const response = await ai.models.generateContent({
			model: modelName,
			contents: [{
				role: 'user',
				parts: [
					{ text: prompt },
					{
						inlineData: {
							mimeType: 'image/png',
							data: referenceBase64,
						}
					}
				]
			}],
			config: generationConfig,
		});

		saveResponse(response, filename);
	} catch (error) {
		console.error(`❌ Test Failed: ${error.message}`);
	}
}

function saveResponse(response, filename) {
	if (!response || !response.candidates || response.candidates.length === 0) {
		console.log('❌ No candidates returned.');
		console.log('Full response:', JSON.stringify(response, null, 2));
		return;
	}

	const parts = response.candidates[0].content?.parts || [];
	let imageSaved = false;

	for (const part of parts) {
		if (part.inlineData && part.inlineData.data) {
			const buffer = Buffer.from(part.inlineData.data, 'base64');
			const outputPath = path.join(__dirname, filename);
			fs.writeFileSync(outputPath, buffer);
			console.log(`✅ Image saved to: ${outputPath}`);
			imageSaved = true;
		}
		if (part.text) {
			console.log(`ℹ️ Text response: "${part.text.substring(0, 100)}..."`);
		}
	}

	if (!imageSaved) {
		console.log('❌ No image data found in response parts.');
	}
}

runTests();
