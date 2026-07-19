import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { useApi } from '@/hooks/useApi';
import { Typography } from '@/constants/theme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { GC_TIMES, queryKeys, STALE_TIMES } from '@/constants/queryKeys';
import { DayPlanItem, ItineraryDetail, getItineraries, getItinerary, updateItemStatus } from '@/api/itineraries';
import { ItineraryOverviewCard } from '@/components/ItineraryOverviewCard';
import { CurrentScheduleCard } from '@/components/CurrentScheduleCard';
import { DayScheduleItem } from '@/components/DayScheduleItem';
import { NewTravelGenerateButton } from '@/components/NewTravelGenerateButton';
import { BOTTOM_NAVIGATION } from '@/constants/layout';

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const;

type Itinerary = {
  itineraryId: string;
  name: string;
  status: 'draft' | 'completed';
  totalDays: number;
  startDate: string;
};

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const generateDayTabs = (startDate: string, totalDays: number) => {
  const start = new Date(startDate);
  return Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return {
      label: `Day ${i + 1}`,
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      dayOfWeek: DAYS_OF_WEEK[date.getDay()],
    };
  });
};

const findActiveItinerary = (itineraries: Itinerary[]): Itinerary | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    itineraries.find(it => {
      const start = new Date(it.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + it.totalDays - 1);
      return today >= start && today <= end;
    }) ?? null
  );
};

const getTodayDayIndex = (startDate: string, totalDays: number): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(diffDays, totalDays - 1));
};

const parseTimeRange = (time: string): { startTime: string; endTime: string } => {
  const sep = time.includes('~') ? '~' : time.includes('-') ? '-' : null;
  if (sep) {
    const parts = time.split(sep);
    return { startTime: parts[0]?.trim() ?? time, endTime: parts[1]?.trim() ?? '' };
  }
  return { startTime: time, endTime: '' };
};

const parseTimeToMinutes = (time: string): number | null => {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
};

export function PlanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { authRequest } = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [pendingStatusItemKey, setPendingStatusItemKey] = useState<string | null>(null);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      timerId = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all, exact: true });
        scheduleNext();
      }, midnight.getTime() - now.getTime());
    };
    scheduleNext();
    return () => clearTimeout(timerId);
  }, [queryClient]);

  const { data: listData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: queryKeys.itineraries.all,
    queryFn: () => authRequest(getItineraries),
    staleTime: STALE_TIMES.itineraries.all,
  });

  const activeItinerary = listData ? findActiveItinerary(listData.itineraries) : null;

  useEffect(() => {
    if (!activeItinerary) return;
    setSelectedDayIndex(getTodayDayIndex(activeItinerary.startDate, activeItinerary.totalDays));
  }, [activeItinerary?.itineraryId]);

  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: queryKeys.itineraries.detail(activeItinerary?.itineraryId ?? ''),
    queryFn: () => authRequest((token) => getItinerary(token, activeItinerary!.itineraryId)),
    enabled: !!activeItinerary,
    staleTime: STALE_TIMES.itineraries.detail,
    gcTime: GC_TIMES.itineraries.detail,
  });

  useEffect(() => {
    if (!listError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(listError) });
  }, [listError]);

  useEffect(() => {
    if (!detailError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(detailError) });
  }, [detailError]);

  const mutation = useMutation({
    mutationFn: ({ dateKey, itemIndex, newStatus }: { dateKey: string; itemIndex: number; newStatus: 'todo' | 'done' }) =>
      authRequest((token) =>
        updateItemStatus(token, activeItinerary!.itineraryId, {
          date: dateKey,
          index: itemIndex,
          status: newStatus,
        }),
      ),
    onSuccess: (res) => {
      queryClient.setQueryData<ItineraryDetail>(
        queryKeys.itineraries.detail(res.itineraryId),
        (old) => {
          if (!old) return old;
          const items = old.dayPlans[res.date];
          if (!items) return old;
          return {
            ...old,
            updatedAt: res.updatedAt,
            dayPlans: {
              ...old.dayPlans,
              [res.date]: items.map((item) =>
                item.index === res.index ? { ...item, status: res.status } : item,
              ),
            },
          };
        },
      );
    },
    onError: (e: unknown) => {
      Toast.show({ type: 'error', text1: getErrorMessage(e) });
    },
    onSettled: () => {
      setPendingStatusItemKey(null);
    },
  });

  if (listLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.pageBg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!activeItinerary) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: colors.pageBg }]}>
        <Text style={[styles.emptyTitle, { color: colors.textTitle }]}>오늘은 여행 일정이 없어요</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textCaption }]}>마실을 떠날 준비가 됐나요?</Text>
        <NewTravelGenerateButton
          onPress={() => router.navigate({ pathname: '/chat', params: { mode: 'new' } })}
        />
      </View>
    );
  }

  const dayTabs = generateDayTabs(activeItinerary.startDate, activeItinerary.totalDays);

  const selectedDate = new Date(activeItinerary.startDate);
  selectedDate.setDate(selectedDate.getDate() + selectedDayIndex);
  const selectedDateKey = formatDateKey(selectedDate);
  const selectedItems: DayPlanItem[] = detail?.dayPlans[selectedDateKey] ?? [];

  const completedCount = selectedItems.filter(item => item.status === 'done').length;
  const totalCount = selectedItems.length;

  const isToday = selectedDateKey === formatDateKey(new Date());
  let currentItem: DayPlanItem | null = null;
  let currentItemLabel = '현재 일정';

  if (isToday) {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const active = selectedItems.find(item => {
      if (item.status === 'done') return false;
      const { startTime, endTime } = parseTimeRange(item.time);
      const start = parseTimeToMinutes(startTime);
      const end = endTime ? parseTimeToMinutes(endTime) : null;
      if (start === null) return false;
      return nowMinutes >= start && (end === null ? nowMinutes <= start + 60 : nowMinutes <= end);
    });
    if (active) {
      currentItem = active;
    } else {
      const next = selectedItems
        .filter(item => item.status !== 'done')
        .find(item => {
          const { startTime } = parseTimeRange(item.time);
          const start = parseTimeToMinutes(startTime);
          return start !== null && start > nowMinutes;
        }) ?? null;
      if (next) {
        currentItem = next;
        currentItemLabel = '다음 일정';
      }
    }
  }

  const currentItemTime = currentItem ? parseTimeRange(currentItem.time) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <ItineraryOverviewCard
        title={activeItinerary.name}
        days={dayTabs}
        activeDay={selectedDayIndex}
        onDayPress={setSelectedDayIndex}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      {detailLoading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          style={styles.scheduleList}
          contentContainerStyle={[
            styles.scheduleContent,
            { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {currentItem && currentItemTime && (
            <CurrentScheduleCard
              title={currentItem.plan_name}
              startTime={currentItemTime.startTime}
              endTime={currentItemTime.endTime}
              location={currentItem.place}
              label={currentItemLabel}
              imageUrl={currentItem.image_url}
            />
          )}
          {selectedItems.length === 0 ? (
            <Text style={[styles.emptyDay, { color: colors.textCaption }]}>
              이 날의 일정이 없어요.
            </Text>
          ) : (
            selectedItems.map((item) => {
              const { startTime, endTime } = parseTimeRange(item.time);
              const itemKey = `${selectedDateKey}:${item.index}`;
              return (
                <DayScheduleItem
                  key={item.index}
                  title={item.plan_name}
                  startTime={startTime}
                  endTime={endTime}
                  location={item.place}
                  memo={item.note || undefined}
                  status={item.status === 'done' ? 'completed' : 'upcoming'}
                  disabled={pendingStatusItemKey === itemKey}
                  onToggle={() => {
                    setPendingStatusItemKey(itemKey);
                    mutation.mutate({
                      dateKey: selectedDateKey,
                      itemIndex: item.index,
                      newStatus: item.status === 'done' ? 'todo' : 'done',
                    });
                  }}
                />
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...Typography['heading-lg'],
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography['body-md'],
    textAlign: 'center',
    marginBottom: 16,
  },
  scheduleList: {
    flex: 1,
  },
  scheduleContent: {
    padding: 16,
    gap: 12,
  },
  emptyDay: {
    ...Typography['body-md'],
    textAlign: 'center',
    marginTop: 24,
  },
});
