import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAge(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "Atualizado agora";
  if (m < 60) return `Atualizado há ${m} min`;
  return `Atualizado há ${Math.floor(m / 60)}h`;
}
