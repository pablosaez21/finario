import {
  Baby, BookOpen, BriefcaseBusiness, Bus, Car, CircleEllipsis, Coffee, Dumbbell, Fuel, Gift,
  GraduationCap, HandCoins, HeartPulse, House, Landmark, Laptop, PawPrint, PiggyBank, Pill, Plane,
  Receipt, Repeat, Shirt, ShoppingBasket, ShoppingCart, Smartphone, Ticket, TrainFront, Utensils,
  Wallet, Wifi, Zap, type LucideIcon, type LucideProps,
} from "lucide-react";

/** Debe coincidir con `ICONS` en src-tauri/src/store.rs. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "shopping-basket": ShoppingBasket,
  "shopping-cart": ShoppingCart,
  house: House,
  "train-front": TrainFront,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  ticket: Ticket,
  repeat: Repeat,
  "heart-pulse": HeartPulse,
  pill: Pill,
  utensils: Utensils,
  coffee: Coffee,
  shirt: Shirt,
  gift: Gift,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  plane: Plane,
  dumbbell: Dumbbell,
  "paw-print": PawPrint,
  baby: Baby,
  smartphone: Smartphone,
  wifi: Wifi,
  zap: Zap,
  receipt: Receipt,
  "piggy-bank": PiggyBank,
  "briefcase-business": BriefcaseBusiness,
  laptop: Laptop,
  wallet: Wallet,
  "hand-coins": HandCoins,
  landmark: Landmark,
  "circle-ellipsis": CircleEllipsis,
};

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = CATEGORY_ICONS[name] ?? CircleEllipsis;
  return <Icon strokeWidth={1.6} aria-hidden="true" {...props} />;
}
