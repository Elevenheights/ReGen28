import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, Img } from 'remotion';

export const WrappedComposition: React.FC<{
  userName: string;
  stats: {
    streak: number;
    totalEntries: number;
    topCategory: string;
  };
  images: string[];
}> = ({ userName, stats, images }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1]);
  const scale = interpolate(frame, [0, 30], [0.8, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}>
      <Sequence from={0} durationInFrames={durationInFrames}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <h1 style={{ color: 'white', fontSize: 80, opacity, transform: `scale(${scale})` }}>
            Hi {userName}!
          </h1>
          <h2 style={{ color: 'white', fontSize: 40, marginTop: 20, opacity }}>
            Here's your week in review
          </h2>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={60} durationInFrames={durationInFrames - 60}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#3b82f6' }}>
          <h1 style={{ color: 'white', fontSize: 100 }}>
            {stats.streak} Day Streak!
          </h1>
          <h2 style={{ color: 'white', fontSize: 50 }}>
            Keep it up!
          </h2>
        </AbsoluteFill>
      </Sequence>
      
      {/* Add more sequences for stats and images */}
    </AbsoluteFill>
  );
};
