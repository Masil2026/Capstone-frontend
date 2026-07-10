import { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { useApi } from '@/hooks/useApi';
import { getErrorMessage, getDeleteChatRoomErrorMessage } from '@/utils/getErrorMessage';
import { formatTripDestinations, toTripInfoInitialValues } from '@/utils/tripInfo';
import { AlertMessages } from '@/constants/alerts';
import { Header } from '@/components/ui/Header';
import { HomeAIBanner } from '@/components/HomeAIBanner';
import { QuickMenu } from '@/components/QuickMenu';
import { RecentTravelSection } from '@/components/RecentTravelSection';
import { RecentChatSection } from '@/components/RecentChatSection';
import { NavigationDrawer } from '@/components/ui/NavigationDrawer';
import { RenameChatModal } from '@/components/RenameChatModal';
import { TripInfoBottomSheet, TripInfo } from '@/components/ui/TripInfoBottomSheet';
import { Alert } from '@/components/ui/Alert';
import { getItineraries, getItinerary, updateItinerary } from '@/api/itineraries';
import { deleteChatRoom, getChatRooms, getChatRoom, updateChatRoomName } from '@/api/chatRooms';
import { BOTTOM_NAVIGATION } from '@/constants/layout';
import { queryKeys, STALE_TIMES, GC_TIMES } from '@/constants/queryKeys';

type TravelItem = {
  id: string;
  title: string;
  dateRange: string;
  status: 'upcoming' | 'completed';
};

type ChatItem = {
  id: string;
  title: string;
  aiSummary: string;
  updatedAt: string;
};

type DrawerChatItem = {
  id: string;
  title: string;
};


const formatDateRange = (startDate: string, totalDays: number): string => {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + totalDays - 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return totalDays === 1 ? fmt(start) : `${fmt(start)} ~ ${fmt(end)}`;
};

const formatRelativeTime = (isoString: string, now: number): string => {
  const diffMin = Math.floor((now - new Date(isoString).getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(isoString).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
};

export function HomeScreen() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [editTripInfoVisible, setEditTripInfoVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pendingDrawerActionRef = useRef<(() => void) | null>(null);

  const { colors } = useTheme();
  const { authRequest } = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  const { data: itData } = useQuery({
    queryKey: queryKeys.itineraries.all,
    queryFn: () => authRequest(getItineraries),
    staleTime: STALE_TIMES.itineraries.all,
  });

  const { data: chatData } = useQuery({
    queryKey: queryKeys.chatRooms.all,
    queryFn: () => authRequest(getChatRooms),
    staleTime: STALE_TIMES.chatRooms.all,
  });

  const { data: selectedRoomData } = useQuery({
    queryKey: queryKeys.chatRooms.detail(selectedChatId ?? ''),
    queryFn: () => authRequest((token) => getChatRoom(token, selectedChatId!)),
    enabled: !!selectedChatId,
    staleTime: STALE_TIMES.chatRooms.detail,
    gcTime: GC_TIMES.chatRooms.detail,
  });

  const { data: itineraryDetail } = useQuery({
    queryKey: queryKeys.itineraries.detail(selectedRoomData?.itineraryId ?? ''),
    queryFn: () => authRequest((token) => getItinerary(token, selectedRoomData!.itineraryId)),
    enabled: !!selectedRoomData?.itineraryId,
    staleTime: STALE_TIMES.itineraries.detail,
    gcTime: GC_TIMES.itineraries.detail,
  });

  const tripInfoInitialValues = useMemo(
    () => (itineraryDetail ? toTripInfoInitialValues(itineraryDetail) : undefined),
    [itineraryDetail],
  );

  // 채팅 탭 전환 시 flash 방지 — 가장 최근 채팅방 detail을 선제 캐싱
  useEffect(() => {
    const mostRecent = chatData?.rooms?.[0];
    if (!mostRecent) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.chatRooms.detail(mostRecent.roomId),
      queryFn: () => authRequest((token) => getChatRoom(token, mostRecent.roomId)),
      staleTime: STALE_TIMES.chatRooms.detail,
      gcTime: GC_TIMES.chatRooms.detail,
    });
  }, [chatData]);

  const travels: TravelItem[] = (itData?.itineraries ?? []).slice(0, 3).map((it) => ({
    id: it.itineraryId,
    title: it.name,
    dateRange: formatDateRange(it.startDate, it.totalDays),
    status: it.status === 'completed' ? 'completed' : 'upcoming',
  }));

  const mappedChats: ChatItem[] = (chatData?.rooms ?? []).map((r) => ({
    id: r.roomId,
    title: r.name,
    aiSummary: r.aiSummary ?? '',
    updatedAt: formatRelativeTime(r.updatedAt, now),
  }));

  const chats = mappedChats.slice(0, 3);
  const allChats: DrawerChatItem[] = mappedChats.map(({ id, title }) => ({ id, title }));
  const selectedChatName = mappedChats.find((chat) => chat.id === selectedChatId)?.title ?? '';

  const renameMutation = useMutation({
    mutationFn: ({ roomId, name }: { roomId: string; name: string }) =>
      authRequest((token) => updateChatRoomName(token, roomId, { name })),
    onSuccess: (updated, { roomId }) => {
      queryClient.setQueryData(
        queryKeys.chatRooms.detail(roomId),
        (old: any) => (old ? { ...old, name: updated.name } : old),
      );
      queryClient.setQueryData<{ rooms: { roomId: string; name: string;[key: string]: unknown }[] }>(
        queryKeys.chatRooms.all,
        (old) => old
          ? { ...old, rooms: old.rooms.map((r) => r.roomId === roomId ? { ...r, name: updated.name } : r) }
          : old,
      );
      setRenameModalVisible(false);
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roomId: string) => authRequest((token) => deleteChatRoom(token, roomId)),
    onSuccess: (_, roomId) => {
      queryClient.setQueryData<{ rooms: { roomId: string }[] }>(
        queryKeys.chatRooms.all,
        (old) => old ? { ...old, rooms: old.rooms.filter((room) => room.roomId !== roomId) } : old,
      );
      queryClient.removeQueries({ queryKey: queryKeys.chatRooms.detail(roomId) });
      queryClient.removeQueries({ queryKey: queryKeys.chatRooms.messages(roomId) });
      queryClient.removeQueries({ queryKey: queryKeys.chatRooms.pending(roomId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
      setSelectedChatId(null);
      Toast.show({ type: 'success', text1: '채팅방이 삭제되었습니다.' });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all });
      Toast.show({ type: 'error', text1: getDeleteChatRoomErrorMessage(error) });
    },
  });

  const updateTripInfoMutation = useMutation({
    mutationFn: ({ info, itineraryId }: { info: TripInfo; itineraryId: string }) =>
      authRequest((token) =>
        updateItinerary(token, itineraryId, {
          origin: { city: info.origin },
          destinations: formatTripDestinations(info.destinations),
          budget: info.budget * 10000,
          adultCount: info.adults,
          childCount: info.children,
          childAges: info.childAges.map((age) => Number(age.replace(/\D/g, ''))),
        }),
      ),
    onSuccess: (_, { itineraryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.detail(itineraryId) });
      setEditTripInfoVisible(false);
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: getErrorMessage(error) });
    },
  });

  const handleViewPlan = async (chatId: string | number) => {
    try {
      const room = await queryClient.fetchQuery({
        queryKey: queryKeys.chatRooms.detail(String(chatId)),
        queryFn: () => authRequest((token) => getChatRoom(token, String(chatId))),
        staleTime: STALE_TIMES.chatRooms.detail,
        gcTime: GC_TIMES.chatRooms.detail,
      });

      if (room.itineraryId) {
        router.push({ pathname: '/plan-list/[id]', params: { id: room.itineraryId } });
      } else {
        router.navigate('/plan-list');
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: getErrorMessage(error) });
      router.navigate('/plan-list');
    }
  };

  const closeDrawerThen = (action?: () => void) => {
    pendingDrawerActionRef.current = action ?? null;
    setDrawerVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <Header />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_NAVIGATION + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <HomeAIBanner
          onPress={() => router.navigate({ pathname: '/chat', params: { mode: 'new' } })}
        />
        <QuickMenu
          onChatPress={() => router.navigate('/chat')}
          onPlanPress={() => router.navigate('/plan')}
        />
        <RecentTravelSection
          travels={travels}
          onTravelPress={(id) => router.push({ pathname: '/plan-list/[id]', params: { id } })}
          onMorePress={() => router.navigate('/plan-list')}
        />
        <RecentChatSection
          chats={chats}
          onChatPress={(id) =>
            router.navigate({ pathname: '/chat/[chatId]', params: { chatId: String(id) } })
          }
          onMorePress={() => setDrawerVisible(true)}
        />
      </ScrollView>

      <NavigationDrawer
        visible={drawerVisible}
        chats={allChats}
        onClose={() => setDrawerVisible(false)}
        onAfterClose={() => {
          const action = pendingDrawerActionRef.current;
          pendingDrawerActionRef.current = null;
          action?.();
        }}
        onNewChat={() => {
          closeDrawerThen(() => {
            router.navigate({ pathname: '/chat', params: { mode: 'new' } });
          });
        }}
        onChatPress={(id) => {
          closeDrawerThen(() => {
            router.navigate({ pathname: '/chat/[chatId]', params: { chatId: String(id) } });
          });
        }}
        onChatRename={(id) => {
          setSelectedChatId(String(id));
          closeDrawerThen(() => setRenameModalVisible(true));
        }}
        onChatEditInfo={(id) => {
          setSelectedChatId(String(id));
          closeDrawerThen(() => setEditTripInfoVisible(true));
        }}
        onChatViewPlan={(id) => {
          closeDrawerThen(() => {
            void handleViewPlan(id);
          });
        }}
        onChatDelete={(id) => {
          setSelectedChatId(String(id));
          closeDrawerThen(() => setDeleteAlertVisible(true));
        }}
      />

      <RenameChatModal
        visible={renameModalVisible}
        initialName={selectedChatName}
        onSave={(name) => {
          if (!selectedChatId || !name.trim()) return;
          renameMutation.mutate({ roomId: selectedChatId, name: name.trim() });
        }}
        onCancel={() => setRenameModalVisible(false)}
      />

      <TripInfoBottomSheet
        visible={editTripInfoVisible}
        mode="edit"
        initialValues={tripInfoInitialValues}
        roomName={selectedChatName || undefined}
        onSubmit={(info) => {
          if (!selectedRoomData?.itineraryId) return;
          updateTripInfoMutation.mutate({ info, itineraryId: selectedRoomData.itineraryId });
        }}
        onClose={() => setEditTripInfoVisible(false)}
      />

      <Alert
        visible={deleteAlertVisible}
        title={AlertMessages.deleteChat.title}
        message={AlertMessages.deleteChat.message}
        confirmLabel={AlertMessages.deleteChat.confirmLabel}
        onConfirm={() => {
          if (!selectedChatId) return;
          const roomId = selectedChatId;
          setDeleteAlertVisible(false);
          setSelectedChatId(null);
          deleteMutation.mutate(roomId);
        }}
        onCancel={() => setDeleteAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    gap: 24,
  },
});
