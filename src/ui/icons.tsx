import React from 'react';
import { IconName } from '../types';

interface StationIconProps {
  name: IconName;
  className?: string;
}

export const StationIcon: React.FC<StationIconProps> = ({ name, className = 'w-5 h-5' }) => {
  const icons: Record<IconName, string> = {
    power: '⚡',
    oxygen: '💨',
    health: '❤️',
    dirt: '🌑',
    heater: '🔥',
    air: '🌬️',
    shield: '🛡️',
    build: '🏗️',
    moon: '🌙',
    sun: '☀️',
    flare: '💥',
    ship: '🚀',
    clean: '🧹',
    treat: '💊',
    exercise: '💪',
    rover: '🚗',
    leak: '💧',
    shelter: '⛺',
    warning: '⚠️',
    check: '✅',
  };

  return (
    <span className={className} role="img" aria-label={name}>
      {icons[name] || '❓'}
    </span>
  );
};