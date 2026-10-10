import {
  BatteryCharging,
  BookOpen,
  Compass,
  Disc3,
  Flame,
  MemoryStick,
  Shield,
  Snowflake,
  Sparkles,
  Syringe,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const relicIcons: Record<string, LucideIcon> = {
  reader: BookOpen,
  cooler: Snowflake,
  firewall: Flame,
  memory: MemoryStick,
  battery: BatteryCharging,
  armor: Shield,
  capacitor: Zap,
  magazine: Disc3,
  firebrand: Sparkles,
  compass: Compass,
  fang: Syringe,
};
