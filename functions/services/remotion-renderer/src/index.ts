import express from 'express';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import React from 'react';
import { WrappedComposition } from './Composition';

initializeApp();
const storage = getStorage();

const app = express();
app.use(express.json());

const port = process.env.PORT || 8080;

app.post('/render', async (req, res) => {
  try {
    const { userId, data, feedItemId } = req.body;

    if (!userId || !data || !feedItemId) {
      return res.status(400).send('Missing required fields');
    }

    console.log(`Rendering video for user ${userId}`);

    // 1. Bundle the composition (in production, bundle at build time for speed)
    // For simplicity here, we assume a pre-bundled location or bundle on fly (slow)
    // Better: use serveUrl if pre-deployed, or bundle once at startup
    
    // For this example, we'll use a simplified approach assuming local component
    // In a real Cloud Run, you'd bundle during Docker build
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, 'Composition.tsx'),
      // If you have a webpack config, pass it here
    });

    // 2. Render the video
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'WrappedComposition',
      inputProps: data,
    });

    const outputLocation = `/tmp/${feedItemId}.mp4`;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps: data,
    });

    // 3. Upload to Firebase Storage
    const bucket = storage.bucket();
    const destination = `wrapped-videos/${userId}/${feedItemId}.mp4`;
    
    await bucket.upload(outputLocation, {
      destination,
      metadata: {
        contentType: 'video/mp4',
      },
    });

    // 4. Get URL (signed or public)
    const file = bucket.file(destination);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500',
    });

    res.json({ success: true, url, path: destination });

  } catch (error: any) {
    console.error('Error rendering video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Remotion renderer listening on port ${port}`);
});
