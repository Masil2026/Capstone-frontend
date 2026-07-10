import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { useApi } from '@/hooks/useApi';
import { Typography } from '@/constants/theme';
import { getErrorMessage, getDeleteChatRoomErrorMessage } from '@/utils/getErrorMessage';
import { formatTripDestinations, toTripInfoInitialValues } from '@/utils/tripInfo';
import { queryKeys, STALE_TIMES, GC_TIMES } from '@/constants/queryKeys';
import { AlertMessages } from '@/constants/alerts';
import { getChatRooms, getChatRoom, createChatRoom, deleteChatRoom, updateChatRoomName } from '@/api/chatRooms';
import { NewTravelGenerateButton } from '@/components/NewTravelGenerateButton';
import { getItinerary, updateItinerary } from '@/api/itineraries';
import { ChatHeader } from '@/components/ChatHeader';
import { NavigationDrawer } from '@/components/ui/NavigationDrawer';
import { TripInfoBottomSheet, TripInfo } from '@/components/ui/TripInfoBottomSheet';
import { RenameChatModal } from '@/components/RenameChatModal';
import { Alert } from '@/components/ui/Alert';


export function NewChatScreen() {
  const { colors } = useTheme();
  const { authRequest } = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [tripSheetVisible, setTripSheetVisible] = useState(true);
  const [editTripInfoVisible, setEditTripInfoVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const pendingDrawerActionRef = useRef<(() => void) | null>(null);

  const { data: chatRoomsData, error: chatRoomsError } = useQuery({
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

  useEffect(() => {
    if (!chatRoomsError) return;
    Toast.show({ type: 'error', text1: getErrorMessage(chatRoomsError) });
  }, [chatRoomsError]);

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof createChatRoom>[1]) =>
      authRequest((token) => createChatRoom(token, body)),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.chatRooms.detail(created.roomId), {
        roomId: created.roomId,
        name: created.name,
        clerkId: created.clerkId,
        aiSummary: null,
        preferences: null,
        itineraryId: created.itineraryId,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all });
      setTripSheetVisible(false);
      router.replace({ pathname: '/chat/[chatId]', params: { chatId: created.roomId } });
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roomId: string) =>
      authRequest((token) => deleteChatRoom(token, roomId)),
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
      Toast.show({ type: 'success', text1: '채팅방이 삭제되었습니다.' });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all });
      Toast.show({ type: 'error', text1: getDeleteChatRoomErrorMessage(error) });
    },
  });

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

  const updateTripInfoMutation = useMutation({
    mutationFn: ({ info, itineraryId }: { info: TripInfo; itineraryId: string }) =>
      authRequest((token) =>
        updateItinerary(token, itineraryId, {
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

  const handleTripSubmit = (info: TripInfo) => {
    createMutation.mutate({
      origin: { city: info.origin },
      destinations: formatTripDestinations(info.destinations),
      budget: info.budget * 10000,
      adultCount: info.adults,
      childCount: info.children,
      childAges: info.childAges.map((age) => Number(age.replace(/\D/g, ''))),
    });
  };

  const handleRenameConfirm = (name: string) => {
    if (!selectedChatId || !name.trim()) return;
    renameMutation.mutate({ roomId: selectedChatId, name: name.trim() });
  };

  const handleDeleteConfirm = () => {
    if (!selectedChatId) return;
    const roomId = selectedChatId;
    setDeleteAlertVisible(false);
    setSelectedChatId(null);
    deleteMutation.mutate(roomId);
  };

  const closeDrawerThen = (action?: () => void) => {
    pendingDrawerActionRef.current = action ?? null;
    setDrawerVisible(false);
  };

  const chatRooms = chatRoomsData?.rooms ?? [];
  const selectedChatName = chatRooms.find((r) => r.roomId === selectedChatId)?.name ?? '';

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <ChatHeader variant="default" onDrawerOpen={() => setDrawerVisible(true)} />

      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.textSub }]}>
          여행 정보를 입력하고,{'\n'}함께 마실을 떠나볼까요?
        </Text>
        <NewTravelGenerateButton onPress={() => setTripSheetVisible(true)} />
      </View>

      <NavigationDrawer
        visible={drawerVisible}
        chats={chatRooms.map((room) => ({ id: room.roomId, title: room.name }))}
        onClose={() => setDrawerVisible(false)}
        onAfterClose={() => {
          const action = pendingDrawerActionRef.current;
          pendingDrawerActionRef.current = null;
          action?.();
        }}
        onNewChat={() => {
          closeDrawerThen(() => setTripSheetVisible(true));
        }}
        onChatPress={(chatId) => {
          closeDrawerThen(() => {
            router.replace({ pathname: '/chat/[chatId]', params: { chatId: String(chatId) } });
          });
        }}
        onChatRename={(chatId) => {
          setSelectedChatId(String(chatId));
          closeDrawerThen(() => setRenameModalVisible(true));
        }}
        onChatEditInfo={(chatId) => {
          setSelectedChatId(String(chatId));
          closeDrawerThen(() => setEditTripInfoVisible(true));
        }}
        onChatViewPlan={(chatId) => {
          closeDrawerThen(async () => {
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
          });
        }}
        onChatDelete={(chatId) => {
          setSelectedChatId(String(chatId));
          closeDrawerThen(() => setDeleteAlertVisible(true));
        }}
      />

      <TripInfoBottomSheet
        visible={tripSheetVisible}
        mode="create"
        onSubmit={handleTripSubmit}
        onClose={() => setTripSheetVisible(false)}
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

      <RenameChatModal
        visible={renameModalVisible}
        initialName={selectedChatName}
        onSave={handleRenameConfirm}
        onCancel={() => setRenameModalVisible(false)}
      />

      <Alert
        visible={deleteAlertVisible}
        title={AlertMessages.deleteChat.title}
        message={AlertMessages.deleteChat.message}
        confirmLabel={AlertMessages.deleteChat.confirmLabel}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  emptyText: {
    ...Typography['body-lg'],
    textAlign: 'center',
  },
});
