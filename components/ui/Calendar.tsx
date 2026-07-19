import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Elevation, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { compareDateOnly, isBetween, isSameDay } from '@/utils/dateOnly';
import { assignEventLanes, getWeekEventSegments, type CalendarEvent } from '@/utils/calendarEvents';
import IcChevronDown from '@/assets/icons/ic_chevron_down.svg';

export type { CalendarEvent };

export type CalendarProps = {
  startDate?: Date | null;
  endDate?: Date | null;
  month: Date;
  minSelectableDate?: Date | null;
  onDayPress?: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  events?: CalendarEvent[];
};

const BAR_HEIGHT = 18;
const LANE_GAP = 4;
const LANE_HEIGHT = BAR_HEIGHT + LANE_GAP;
const NOOP = () => {};

export function Calendar({
  startDate = null,
  endDate = null,
  month,
  minSelectableDate = null,
  onDayPress = NOOP,
  onPrevMonth,
  onNextMonth,
  events = [],
}: CalendarProps) {
  const { colors, scheme } = useTheme();
  const lanesByEventId = useMemo(() => assignEventLanes(events), [events]);
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, mon, index + 1)),
  ];
  const weeks: (Date | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <View style={[styles.calendarPanel, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={onPrevMonth} style={styles.calendarNavButton}>
          {({ pressed }) => (
            <>
              <View style={styles.chevronLeft}>
                <IcChevronDown width={18} height={18} color={colors.textCaption} />
              </View>
              {pressed && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
        <Text style={[styles.calendarMonth, { color: colors.textTitle }]}>
          {year}년 {mon + 1}월
        </Text>
        <Pressable onPress={onNextMonth} style={styles.calendarNavButton}>
          {({ pressed }) => (
            <>
              <View style={styles.chevronRight}>
                <IcChevronDown width={18} height={18} color={colors.textCaption} />
              </View>
              {pressed && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.calendarRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <Text key={day} style={[styles.calendarDayHeader, { color: colors.textCaption }]}>
            {day}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => {
        const weekStart = new Date(year, mon, 1 - firstDay + weekIndex * 7);
        const weekEnd = new Date(year, mon, 1 - firstDay + weekIndex * 7 + 6);
        const segments = events.length > 0 ? getWeekEventSegments(weekStart, weekEnd, events, lanesByEventId) : [];
        const laneCount = segments.reduce((max, segment) => Math.max(max, segment.lane + 1), 0);

        return (
          <View key={weekIndex} style={styles.weekBlock}>
            <View style={styles.calendarRow}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={dayIndex} style={styles.calendarCell} />;

                const isStart = !!startDate && isSameDay(day, startDate);
                const isEnd = !!endDate && isSameDay(day, endDate);
                const inRange = !!startDate && !!endDate && isBetween(day, startDate, endDate);
                const isSelected = isStart || isEnd;
                const isDisabled = minSelectableDate != null && compareDateOnly(day, minSelectableDate) < 0 && !isSelected;
                const isFirstRangeDay =
                  inRange &&
                  !!startDate &&
                  isSameDay(day, new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1));
                const isLastRangeDay =
                  inRange &&
                  !!endDate &&
                  isSameDay(day, new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1));

                return (
                  <Pressable
                    key={dayIndex}
                    disabled={isDisabled}
                    onPress={() => onDayPress(day)}
                    style={styles.calendarCell}
                  >
                    {({ pressed }) => (
                      <>
                        {inRange && (
                          <View
                            style={[
                              styles.calendarRangeBackground,
                              { backgroundColor: colors.primaryTint },
                              isFirstRangeDay && styles.calendarRangeStart,
                              isLastRangeDay && styles.calendarRangeEnd,
                            ]}
                          />
                        )}
                        <View
                          style={[
                            styles.calendarDay,
                            isSelected && { backgroundColor: colors.primary },
                            pressed && !isSelected && !isDisabled && { backgroundColor: colors.pressOverlay },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              { color: isSelected ? colors.pageBg : isDisabled ? colors.textDisabled : colors.textTitle },
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {laneCount > 0 && (
              <View style={[styles.eventLaneArea, { height: laneCount * LANE_HEIGHT }]}>
                {segments.map((segment, segmentIndex) => (
                  <View
                    key={`${segment.id}-${weekIndex}-${segmentIndex}`}
                    style={[
                      styles.eventBar,
                      {
                        left: `${(segment.startCol / 7) * 100}%`,
                        width: `${((segment.endCol - segment.startCol + 1) / 7) * 100}%`,
                        top: segment.lane * LANE_HEIGHT,
                        backgroundColor: colors.primaryTint,
                      },
                      segment.isEventStart && styles.eventBarStart,
                      segment.isEventEnd && styles.eventBarEnd,
                    ]}
                  >
                    {segment.isEventStart && (
                      <View style={[styles.eventBarAccent, { backgroundColor: colors.primary }]} />
                    )}
                    <Text numberOfLines={1} style={[styles.eventBarText, { color: colors.textTitle }]}>
                      {segment.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  calendarPanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  chevronLeft: {
    transform: [{ rotate: '90deg' }],
  },
  chevronRight: {
    transform: [{ rotate: '-90deg' }],
  },
  calendarMonth: {
    ...Typography['heading-sm'],
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarDayHeader: {
    ...Typography['caption'],
    flex: 1,
    paddingVertical: 6,
    textAlign: 'center',
  },
  weekBlock: {
    marginBottom: 2,
  },
  calendarCell: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 2,
    position: 'relative',
  },
  calendarRangeBackground: {
    bottom: 2,
    left: -1,
    position: 'absolute',
    right: -1,
    top: 2,
  },
  calendarRangeStart: {
    borderBottomLeftRadius: BorderRadius.full,
    borderTopLeftRadius: BorderRadius.full,
  },
  calendarRangeEnd: {
    borderBottomRightRadius: BorderRadius.full,
    borderTopRightRadius: BorderRadius.full,
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34,
  },
  calendarDayText: {
    ...Typography['body-md'],
  },
  eventLaneArea: {
    marginTop: 2,
    position: 'relative',
  },
  eventBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: BAR_HEIGHT,
    overflow: 'hidden',
    paddingHorizontal: 6,
    position: 'absolute',
  },
  eventBarStart: {
    borderBottomLeftRadius: BorderRadius.xs,
    borderTopLeftRadius: BorderRadius.xs,
  },
  eventBarEnd: {
    borderBottomRightRadius: BorderRadius.xs,
    borderTopRightRadius: BorderRadius.xs,
  },
  eventBarAccent: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  eventBarText: {
    ...Typography['caption'],
    marginLeft: 4,
  },
});
