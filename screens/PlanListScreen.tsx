import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useApi } from '@/hooks/useApi';
import { useTheme } from '@/hooks/useTheme';
import { getItineraries, updateItineraryStatus } from '@/api/itineraries';
import type { ItineraryDetail } from '@/api/itineraries';
import { getReservations } from '@/api/reservations';
import { queryKeys, STALE_TIMES } from '@/constants/queryKeys';
import { BOTTOM_NAVIGATION } from '@/constants/layout';
import { Typography } from '@/constants/theme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { formatTripDestinationCities } from '@/utils/tripInfo';
import { TravelListTabBar } from '@/components/TravelListTabBar';
import { TravelPlanCard } from '@/components/TravelPlanCard';
import { ReservationCard } from '@/components/ReservationCard';
import { ReservationStatusFilter } from '@/components/ReservationStatusFilter';
import { ReservationTypeTab } from '@/components/ReservationTypeTab';

type Tab = 'itinerary' | 'calendar';
type ResType = 'all' | 'flight' | 'accommodation';
type ResStatus = 'all' | 'confirmed' | 'changed' | 'cancelled';

function formatDate(dateStr: string) {
  return dateStr.replace(/-/g, '.');
}

function formatDuration(totalDays: number) {
  if (totalDays <= 1) return '당일치기';
  return `${totalDays - 1}박 ${totalDays}일`;
}

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return '-';
  const symbol = currency === 'KRW' ? '₩' : (currency ?? '');
  return `${symbol}${price.toLocaleString()}`;
}

function formatTime(datetime: string) {
  const d = new Date(datetime);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(datetime: string) {
  const d = new Date(datetime);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function calcFlightDuration(departure: string, arrival: string) {
  const diff = Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function PlanListScreen() {
  const { colors } = useTheme();
  const { authRequest } = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('itinerary');
  const [resType, setResType] = useState<ResType>('all');
  const [resStatus, setResStatus] = useState<ResStatus>('all');

  const {
    data: itinerariesData,
    isLoading: isLoadingItineraries,
    error: itinerariesError,
  } = useQuery({
    queryKey: queryKeys.itineraries.all,
    queryFn: () => authRequest(getItineraries),
    staleTime: STALE_TIMES.itineraries.all,
  });

  const {
    data: reservationsData,
    isLoading: isLoadingReservations,
    error: reservationsError,
  } = useQuery({
    queryKey: queryKeys.reservations.all,
    queryFn: () => authRequest(getReservations),
    staleTime: STALE_TIMES.reservations.all,
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
    if (tab !== 'itinerary' || !itinerariesError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(itinerariesError) });
  }, [tab, itinerariesError]);

  useEffect(() => {
    if (tab !== 'calendar' || !reservationsError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(reservationsError) });
  }, [tab, reservationsError]);

  const itineraries = itinerariesData?.itineraries ?? [];
  const allReservations = (reservationsData?.reservations ?? []).filter(
    (r) => r.type === 'flight' || r.type === 'accommodation',
  );
  const filteredReservations = allReservations
    .filter((r) => resType === 'all' || r.type === resType)
    .filter((r) => resStatus === 'all' || r.status === resStatus);

  const isLoading = tab === 'itinerary' ? isLoadingItineraries : isLoadingReservations;

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
        <View style={styles.reservationSection}>
          <ReservationTypeTab selected={resType} onSelect={setResType} />
          <ReservationStatusFilter selected={resStatus} onSelect={setResStatus} />
          <ScrollView
            contentContainerStyle={[
              styles.list,
              { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 16 },
            ]}
          >
            {filteredReservations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, { color: colors.textTitle }]}>
                  예약 내역이 없습니다
                </Text>
                <Text style={[styles.emptyText, { color: colors.textCaption }]}>
                  선택한 조건에 해당하는 예약이 없습니다.
                </Text>
              </View>
            ) : (
              filteredReservations.map((r) => {
                const common = {
                  price: formatPrice(r.totalPrice, r.currency),
                  bookedBy: r.bookedBy,
                  reservationNumber: r.externalRefId ?? r.reservationId,
                  reservationDate: formatDateShort(r.reservedAt),
                  status: r.status,
                };

                if (r.type === 'flight') {
                  const d = r.detail;
                  return (
                    <ReservationCard
                      key={r.reservationId}
                      type="flight"
                      departureCode={d.departure}
                      arrivalCode={d.arrival}
                      duration={calcFlightDuration(d.departing_at, d.arriving_at)}
                      departureTime={formatTime(d.departing_at)}
                      arrivalTime={formatTime(d.arriving_at)}
                      date={formatDateShort(d.departing_at)}
                      airline={d.airline}
                      {...common}
                    />
                  );
                }

                const d = r.detail;
                return (
                  <ReservationCard
                    key={r.reservationId}
                    type="lodging"
                    hotelName={d.name}
                    checkInDate={d.check_in}
                    checkOutDate={d.check_out}
                    roomType={`${d.rooms}실`}
                    guests={d.guests}
                    {...common}
                  />
                );
              })
            )}
          </ScrollView>
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
  reservationSection: { flex: 1 },
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
