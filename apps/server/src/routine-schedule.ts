import type { RoutineSchedule } from "../../../packages/domain/src/agent.ts";

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}
const weekdays: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
    weekday: weekdays[value.weekday],
  };
}

function zonedInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  for (let shift = 0; shift <= 180; shift++) {
    const localTarget = desired + shift * 60000;
    let candidate = localTarget;
    for (let iteration = 0; iteration < 4; iteration++) {
      const parts = localParts(new Date(candidate), timeZone);
      const represented = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
      );
      const next = localTarget - (represented - candidate);
      if (next === candidate) break;
      candidate = next;
    }
    const actual = localParts(new Date(candidate), timeZone);
    const expected = new Date(localTarget);
    if (
      actual.year === expected.getUTCFullYear() &&
      actual.month === expected.getUTCMonth() + 1 &&
      actual.day === expected.getUTCDate() &&
      actual.hour === expected.getUTCHours() &&
      actual.minute === expected.getUTCMinutes()
    )
      return new Date(candidate);
  }
  throw new Error("Could not resolve the routine time in its time zone");
}

export function nextRoutineRun(schedule: RoutineSchedule, after = new Date()): string {
  const current = localParts(after, schedule.timeZone);
  const [hour, minute] = schedule.time.split(":").map(Number);
  const today = Date.UTC(current.year, current.month - 1, current.day);
  for (let offset = 0; offset < 8; offset++) {
    const localDay = new Date(today + offset * 86400000);
    const dayOfWeek = localDay.getUTCDay();
    if (schedule.frequency === "weekly" && !schedule.daysOfWeek.includes(dayOfWeek)) continue;
    const candidate = zonedInstant(
      localDay.getUTCFullYear(),
      localDay.getUTCMonth() + 1,
      localDay.getUTCDate(),
      hour,
      minute,
      schedule.timeZone,
    );
    if (candidate.getTime() > after.getTime()) return candidate.toISOString();
  }
  throw new Error("No routine run time was found in the next week");
}
