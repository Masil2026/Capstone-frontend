import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useApi } from '@/hooks/useApi';
import { useTheme } from '@/hooks/useTheme';
import { getItinerary, getItineraryLogs } from '@/api/itineraries';
import { GC_TIMES, queryKeys, STALE_TIMES } from '@/constants/queryKeys';
import { BOTTOM_NAVIGATION } from '@/constants/layout';
import { BorderRadius, Typography } from '@/constants/theme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { getDisplayCost } from '@/utils/itineraryDisplay';
import { formatTripDestinationCities } from '@/utils/tripInfo';
import { ItineraryOverviewCard2BeforeEdit } from '@/components/ItineraryOverviewCard2BeforeEdit';
import { PlanDetailItem } from '@/components/PlanDetailItem';

type Props = {
  itineraryId: string;
  logId: string;
};

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLogDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function splitTimeRange(time: string): { startTime: string; endTime: string } {
  const [startTime, endTime = ''] = time.split('~').map((part) => part.trim());
  return { startTime, endTime };
}

export function ChangeLogDetailScreen({ itineraryId, logId }: Props) {
  const { colors } = useTheme();
  const { authRequest } = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedDay, setSelectedDay] = useState(1);

  const {
    data: itinerary,
    isLoading: isLoadingItinerary,
    error: itineraryError,
  } = useQuery({
    queryKey: queryKeys.itineraries.detail(itineraryId),
    queryFn: () => authRequest((token) => getItinerary(token, itineraryId)),
    staleTime: STALE_TIMES.itineraries.detail,
    gcTime: GC_TIMES.itineraries.detail,
  });

  const {
    data: logsData,
    isLoading: isLoadingLogs,
    error: logsError,
  } = useQuery({
    queryKey: queryKeys.itineraries.logs(itineraryId),
    queryFn: () => authRequest((token) => getItineraryLogs(token, itineraryId)),
    staleTime: STALE_TIMES.itineraries.logs,
    gcTime: GC_TIMES.itineraries.logs,
  });

  useEffect(() => {
    if (!itineraryError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(itineraryError) });
  }, [itineraryError]);

  useEffect(() => {
    if (!logsError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(logsError) });
  }, [logsError]);

  const log = useMemo(
    () => logsData?.logs.find((l) => l.logId === logId),
    [logsData, logId],
  );

  const changeLogs = useMemo(
    () => (logsData?.logs ?? []).map((item) => ({ logId: item.logId, date: formatLogDate(item.createdAt) })),
    [logsData?.logs],
  );

  const activeDayPlans = useMemo(() => {
    if (!log) return [];
    const dateKey = addDays(log.startDate, selectedDay - 1);
    return log.dayPlans[dateKey] ?? [];
  }, [log, selectedDay]);

  if (isLoadingItinerary || isLoadingLogs) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.pageBg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!itinerary || !log) return null;

  const headerDate = `${itinerary.startDate.replace(/-/g, '.')} - ${itinerary.endDate.replace(/-/g, '.')}`;
  const headerLocation = formatTripDestinationCities(itinerary.destinations);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <ItineraryOverviewCard2BeforeEdit
        title={itinerary.name}
        date={headerDate}
        location={headerLocation}
        dayCount={log.totalDays}
        selectedDay={selectedDay}
        onDayPress={setSelectedDay}
        onBack={() => router.back()}
        changeLogDate={formatLogDate(log.createdAt)}
        changeLogs={changeLogs}
        onChangeLogPress={(nextLogId) => {
          router.replace({
            pathname: '/plan-list/[id]/logs/[logId]',
            params: { id: itineraryId, logId: nextLogId },
          });
        }}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 24 },
        ]}
      >
        <View style={[styles.detailPanel, { backgroundColor: colors.secondarySurface, borderColor: colors.divider }]}>
          <Text style={[styles.detailTitle, { color: colors.textTitle }]}>일정 상세</Text>
          <View style={styles.detailList}>
            {activeDayPlans.map((item, index) => {
              const { startTime, endTime } = splitTimeRange(item.time);
              const { price, currency } = getDisplayCost(item.cost);
              return (
                <PlanDetailItem
                  key={`day${selectedDay}-item${index}`}
                  title={item.plan_name}
                  startTime={startTime}
                  endTime={endTime}
                  memo={item.note || undefined}
                  location={item.place || undefined}
                  price={price}
                  currency={currency}
                  imageUrl={item.image_url}
                  showConnector={index + 1 < activeDayPlans.length}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  detailPanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },
  detailTitle: {
    ...Typography['heading-md'],
  },
  detailList: {
    gap: 12,
  },
});
