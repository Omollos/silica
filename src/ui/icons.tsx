import {
  Check,
  Cross,
  Droplets,
  Dumbbell,
  Flame,
  Hammer,
  Heart,
  House,
  Moon,
  Mountain,
  Rocket,
  Shield,
  Sparkles,
  Sun,
  TriangleAlert,
  Truck,
  Wind,
  Zap,
} from 'lucide-react';
import { IconName } from '../types';

const icons = {
  power: Zap,
  oxygen: Wind,
  health: Heart,
  dirt: Mountain,
  heater: Flame,
  air: Wind,
  shield: Shield,
  build: Hammer,
  moon: Moon,
  sun: Sun,
  flare: Sun,
  ship: Rocket,
  clean: Sparkles,
  treat: Cross,
  exercise: Dumbbell,
  rover: Truck,
  leak: Droplets,
  shelter: House,
  warning: TriangleAlert,
  check: Check,
} satisfies Record<IconName, typeof Zap>;

interface StationIconProps {
  name: IconName;
  className?: string;
}

export function StationIcon({ name, className }: StationIconProps) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} />;
}
