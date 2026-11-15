import React from 'react';

interface AstronautFaceProps {
  health: number;
  oxygen: number;
  sick: boolean;
  sky: string;
  status: string;
}

export const AstronautFace: React.FC<AstronautFaceProps> = ({
  health,
  oxygen,
  sick,
  sky,
  status,
}) => {
  const isHealthy = health > 50 && oxygen > 20 && !sick;
  const isCritical = health < 30 || oxygen < 10;

  let faceEmoji = '😊';
  if (isCritical) faceEmoji = '😵';
  else if (!isHealthy) faceEmoji = '😐';
  else if (health > 80) faceEmoji = '😄';

  return (
    <div className={`text-6xl transition-transform ${status === 'lost' ? 'grayscale' : ''}`}>
      {faceEmoji}
    </div>
  );
};