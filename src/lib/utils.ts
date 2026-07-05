import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreColor(score: number): string {
  if (score >= 0.85) return "#10b981"; // aligned
  if (score >= 0.7) return "#f59e0b"; // drifting
  return "#ef4444"; // conflict
}

export function scoreLabel(score: number): string {
  if (score >= 0.85) return "Aligned";
  if (score >= 0.7) return "Drifting";
  return "Conflict";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function relDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
