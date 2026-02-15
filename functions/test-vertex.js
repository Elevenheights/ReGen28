/* eslint-disable no-console */
const { PredictionServiceClient, helpers } = require('@google-cloud/aiplatform');
const fs = require('fs');
const path = require('path');

// Configuration
const projectId = process.env.GCLOUD_PROJECT || 'regen28-2fe51';
const location = 'us-central1';
const publisher = 'google';
const model = 'imagegeneration@005'; // Imagen 2

async function run() {
	console.log('--- Testing Vertex AI (Imagen 2) ---');
	console.log(`Project: ${projectId}`);
	console.log(`Location: ${location}`);
	console.log(`Model: ${model}`);

	const clientOptions = {
		apiEndpoint: `${location}-aiplatform.googleapis.com`,
	};

	const predictionServiceClient = new PredictionServiceClient(clientOptions);

	const prompt = 'A serene futuristic garden with glowing plants, digital art style';
	console.log(`Generating image for prompt: "${prompt}"...`);

	try {
		const endpoint = `projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}`;

		const instances = [
			helpers.toValue({
				prompt: prompt,
				sampleCount: 1,
			}),
		];

		const parameters = helpers.toValue({
			sampleCount: 1,
			aspectRatio: '1:1',
			personGeneration: 'allow_adult',
		});

		const [response] = await predictionServiceClient.predict({
			endpoint,
			instances,
			parameters,
		});

		if (response.predictions && response.predictions.length > 0) {
			console.log('Generation successful! Saving image...');

			const prediction = response.predictions[0];
			const b64Image = prediction.structValue?.fields?.bytesBase64Encoded?.stringValue;

			if (b64Image) {
				const buffer = Buffer.from(b64Image, 'base64');
				const outputPath = path.join(__dirname, 'test-output-vertex.png');
				fs.writeFileSync(outputPath, buffer);
				console.log(`Image saved to: ${outputPath}`);
			} else {
				console.error('No image data found in prediction.');
			}
		} else {
			console.error('No predictions returned.');
		}
	} catch (error) {
		console.error('Error during generation:', error);
		console.log('\n--- TROUBLESHOOTING ---');
		console.log('1. Ensure you have run: gcloud auth application-default login');
		console.log('2. Ensure the "Vertex AI API" is enabled in Google Cloud Console.');
		console.log('3. Ensure your account/service account has "Vertex AI User" role.');
	}
}

run();
