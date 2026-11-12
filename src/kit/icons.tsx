/**
 * アイコン(lucide-react、ISC ライセンス)。よく使うものを日本語の名前つきで選んである。
 * 部品からは <Icon name="lightbulb" /> と、field.icon で選ばせた名前を渡して使う。
 * アイコンを増やすときは icon-names.ts と ICONS に 1 行ずつ足す(lucide の名前は https://lucide.dev/icons を参照)。
 */
import type { ComponentType, SVGProps } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Camera,
  CheckCircle,
  Clock,
  Cloud,
  Code,
  Coins,
  Cpu,
  Database,
  Eye,
  FileText,
  Flag,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Key,
  Layers,
  Leaf,
  Lightbulb,
  Link,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  PiggyBank,
  Puzzle,
  Recycle,
  Rocket,
  Search,
  Server,
  Settings,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Sun,
  Target,
  Trophy,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

import { type IconName } from './icon-names';

export { ICON_OPTIONS, type IconName } from './icon-names';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/** 名前 → 絵(lucide のコンポーネント)。アイコンを増やすときは icon-names.ts とここの両方に 1 行足す */
export const ICONS: Record<IconName, IconComponent> = {
  lightbulb: Lightbulb,
  target: Target,
  rocket: Rocket,
  zap: Zap,
  shield: Shield,
  lock: Lock,
  key: Key,
  eye: Eye,
  search: Search,
  check: CheckCircle,
  alert: AlertTriangle,
  clock: Clock,
  users: Users,
  message: MessageCircle,
  mail: Mail,
  heart: Heart,
  star: Star,
  trophy: Trophy,
  flag: Flag,
  gift: Gift,
  trend: TrendingUp,
  coins: Coins,
  wallet: Wallet,
  piggy: PiggyBank,
  cart: ShoppingCart,
  truck: Truck,
  package: Package,
  building: Building2,
  map: MapPin,
  globe: Globe,
  link: Link,
  layers: Layers,
  puzzle: Puzzle,
  settings: Settings,
  code: Code,
  cpu: Cpu,
  server: Server,
  database: Database,
  cloud: Cloud,
  phone: Smartphone,
  bot: Bot,
  brain: Brain,
  book: BookOpen,
  study: GraduationCap,
  file: FileText,
  camera: Camera,
  leaf: Leaf,
  sun: Sun,
  recycle: Recycle,
};

/** アイコン。知らない名前ならひらめきのアイコンを出す */
export const Icon = ({ name, size = 48, color, strokeWidth = 2 }: { name: string; size?: number; color?: string; strokeWidth?: number }) => {
  const C = (ICONS as Record<string, IconComponent>)[name] ?? Lightbulb;
  return <C size={size} color={color} strokeWidth={strokeWidth} style={{ display: 'block', flex: 'none' }} />;
};
