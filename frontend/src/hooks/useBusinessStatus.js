import { useEffect, useMemo, useState } from "react";

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getZonedTime(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return {
      day: values.weekday.toLowerCase(),
      minutes: Number(values.hour) * 60 + Number(values.minute),
    };
  } catch {
    return null;
  }
}

function validSchedule(schedule) {
  if (!schedule || schedule.closed) return null;
  const open = parseTime(schedule.open);
  const close = parseTime(schedule.close);
  if (open == null || close == null) return null;
  return { ...schedule, openMinutes: open, closeMinutes: close };
}

export function calculateBusinessStatus(config, date = new Date()) {
  if (!config?.business_hours_enabled) return null;

  const zoned = getZonedTime(
    date,
    config.business_hours_timezone || "America/Sao_Paulo"
  );
  if (!zoned) return null;

  const hours = config.business_hours || {};
  const dayIndex = DAYS.indexOf(zoned.day);
  const today = validSchedule(hours[zoned.day]);
  const previousDay = DAYS[(dayIndex + 6) % 7];
  const previous = validSchedule(hours[previousDay]);

  if (
    previous &&
    previous.closeMinutes <= previous.openMinutes &&
    zoned.minutes < previous.closeMinutes
  ) {
    return {
      isOpen: true,
      statusLabel: "Aberto agora",
      timingLabel: `Fecha às ${previous.close}`,
    };
  }

  if (today) {
    const spansMidnight = today.closeMinutes <= today.openMinutes;
    const openNow = spansMidnight
      ? zoned.minutes >= today.openMinutes
      : zoned.minutes >= today.openMinutes && zoned.minutes < today.closeMinutes;

    if (openNow) {
      return {
        isOpen: true,
        statusLabel: "Aberto agora",
        timingLabel: `Fecha às ${today.close}`,
      };
    }
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const nextDay = DAYS[(dayIndex + offset) % 7];
    const schedule = validSchedule(hours[nextDay]);
    if (!schedule) continue;
    if (offset === 0 && zoned.minutes >= schedule.openMinutes) continue;

    return {
      isOpen: false,
      statusLabel: "Fechado agora",
      timingLabel: `Abre às ${schedule.open}`,
    };
  }

  return {
    isOpen: false,
    statusLabel: "Fechado agora",
    timingLabel: null,
  };
}

export function useBusinessStatus(config) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!config?.business_hours_enabled) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [config?.business_hours_enabled]);

  return useMemo(() => calculateBusinessStatus(config, now), [config, now]);
}
