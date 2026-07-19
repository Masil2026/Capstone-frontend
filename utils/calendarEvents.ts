import { compareDateOnly, isSameDay } from './dateOnly';

export type CalendarEvent = {
  id: string;
  startDate: Date;
  endDate: Date;
  label: string;
};

export type CalendarEventSegment = {
  id: string;
  label: string;
  startCol: number;
  endCol: number;
  isEventStart: boolean;
  isEventEnd: boolean;
  lane: number;
};

export function assignEventLanes(events: CalendarEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => compareDateOnly(a.startDate, b.startDate));
  const laneEndDates: Date[] = [];
  const lanes = new Map<string, number>();

  for (const event of sorted) {
    let lane = laneEndDates.findIndex(endDate => compareDateOnly(endDate, event.startDate) < 0);
    if (lane === -1) {
      lane = laneEndDates.length;
      laneEndDates.push(event.endDate);
    } else {
      laneEndDates[lane] = event.endDate;
    }
    lanes.set(event.id, lane);
  }

  return lanes;
}

export function getWeekEventSegments(
  weekStart: Date,
  weekEnd: Date,
  events: CalendarEvent[],
  lanesByEventId: Map<string, number>,
): CalendarEventSegment[] {
  return events
    .filter(event => compareDateOnly(event.endDate, weekStart) >= 0 && compareDateOnly(event.startDate, weekEnd) <= 0)
    .map(event => {
      const segStart = compareDateOnly(event.startDate, weekStart) > 0 ? event.startDate : weekStart;
      const segEnd = compareDateOnly(event.endDate, weekEnd) < 0 ? event.endDate : weekEnd;
      return {
        id: event.id,
        label: event.label,
        startCol: segStart.getDay(),
        endCol: segEnd.getDay(),
        isEventStart: isSameDay(segStart, event.startDate),
        isEventEnd: isSameDay(segEnd, event.endDate),
        lane: lanesByEventId.get(event.id) ?? 0,
      };
    });
}
