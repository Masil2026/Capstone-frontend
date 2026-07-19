import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useApi } from '@/hooks/useApi';
import { useTheme } from '@/hooks/useTheme';
import { getItineraries, updateItineraryStatus } from '@/api/itineraries';
import type { ItineraryDetail } from '@/api/itineraries';
import { queryKeys, STALE_TIMES } from '@/constants/queryKeys';
import { BOTTOM_NAVIGATION } from '@/constants/layout';
import { Typography } from '@/constants/theme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { formatTripDestinationCities, itineraryToCalendarEvent } from '@/utils/tripInfo';
import { addMonths } from '@/utils/dateOnly';
import { TravelListTabBar } from '@/components/TravelListTabBar';
import { TravelPlanCard } from '@/components/TravelPlanCard';
import { Calendar } from '@/components/ui/Calendar';

type Tab = 'itinerary' | 'calendar';

function formatDate(dateStr: string) {
  return dateStr.replace(/-/g, '.');
}

function formatDuration(totalDays: number) {
  if (totalDays <= 1) return '당일치기';
  return `${totalDays - 1}박 ${totalDays}일`;
}

export function PlanListScreen() {
  const { colors } = useTheme();
  const { authRequest } = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('itinerary');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const {
    data: itinerariesData,
    isLoading: isLoadingItineraries,
    error: itinerariesError,
  } = useQuery({
    queryKey: queryKeys.itineraries.all,
    queryFn: () => authRequest(getItineraries),
    staleTime: STALE_TIMES.itineraries.all,
  });

  type ItinerariesData = NonNullable<typeof itinerariesData>;

  const statusMutation = useMutation({
    mutationFn: ({ itineraryId, status }: { itineraryId: string; status: 'draft' | 'completed' }) =>
      authRequest((token) => updateItineraryStatus(token, itineraryId, { status })),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData<ItinerariesData>(queryKeys.itineraries.all, (previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          itineraries: previous.itineraries.map((itinerary) =>
            itinerary.itineraryId === updatedItinerary.itineraryId
              ? { ...itinerary, status: updatedItinerary.status }
              : itinerary,
          ),
        };
      });

      queryClient.setQueryData<ItineraryDetail>(
        queryKeys.itineraries.detail(updatedItinerary.itineraryId),
        (previous) =>
          previous
            ? { ...previous, status: updatedItinerary.status, updatedAt: updatedItinerary.updatedAt }
            : previous,
      );
    },
    onError: (e) => {
      Toast.show({ type: 'error', text1: getErrorMessage(e) });
    },
  });

  useEffect(() => {
    if (!itinerariesError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(itinerariesError) });
  }, [itinerariesError]);

  const itineraries = useMemo(() => itinerariesData?.itineraries ?? [], [itinerariesData]);
  const isLoading = isLoadingItineraries;

  const events = useMemo(() => itineraries.map(itineraryToCalendarEvent), [itineraries]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.safeAreaTop, { height: insets.top, backgroundColor: colors.cardBg }]} />
      <TravelListTabBar tab={tab} onTabChange={setTab} />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      ) : tab === 'itinerary' ? (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 16 },
          ]}
        >
          {itineraries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.textTitle }]}>
                여행 일정이 없습니다
              </Text>
              <Text style={[styles.emptyText, { color: colors.textCaption }]}>
                AI 채팅에서 여행 일정을 만들어보세요.
              </Text>
            </View>
          ) : (
            itineraries.map((item) => (
              <TravelPlanCard
                key={item.itineraryId}
                title={item.name}
                startDate={formatDate(item.startDate)}
                destination={formatTripDestinationCities(item.destinations)}
                duration={formatDuration(item.totalDays)}
                status={item.status === 'completed' ? 'completed' : 'upcoming'}
                onPress={() =>
                  router.push({ pathname: '/plan-list/[id]', params: { id: item.itineraryId } })
                }
                onStatusToggle={() =>
                  statusMutation.mutate({
                    itineraryId: item.itineraryId,
                    status: item.status === 'completed' ? 'draft' : 'completed',
                  })
                }
              />
            ))
          )}
        </ScrollView>
      ) : (
        <View style={[styles.calendarSection, { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 16 }]}>
          <Calendar
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth((value) => addMonths(value, -1))}
            onNextMonth={() => setCalendarMonth((value) => addMonths(value, 1))}
            events={events}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safeAreaTop: { width: '100%' },
  list: { padding: 16, gap: 12 },
  calendarSection: { padding: 16 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    ...Typography['heading-sm'],
  },
  emptyText: {
    ...Typography['body-md'],
    textAlign: 'center',
  },
});
