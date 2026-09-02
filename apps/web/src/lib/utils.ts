import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Session } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function groupSessionsByTime(sessions: Session[]) {
  const now = new Date();
  const today: Session[] = [];
  const yesterday: Session[] = [];
  const older: Session[] = [];

  for (const s of sessions) {
    const days = (now.getTime() - new Date(s.createdAt).getTime()) / 86400000;
    if (days < 1) today.push(s);
    else if (days < 2) yesterday.push(s);
    else older.push(s);
  }

  return { today, yesterday, older };
}
