import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { useApi } from '@/hooks/useApi';
import { getErrorMessage, getDeleteChatRoomErrorMessage } from '@/utils/getErrorMessage';
import { formatKoreanTime } from '@/utils/dateTime';
import { formatTripDestinations, toTripInfoInitialValues } from '@/utils/tripInfo';
import { queryKeys, STALE_TIMES, GC_TIMES } from '@/constants/queryKeys';
import { AlertMessages } from '@/constants/alerts';
import { getChatRooms, getChatRoom, deleteChatRoom, updateChatRoomName } from '@/api/chatRooms';
import {
  getChatMessages,
  sendChatMessageStream,
  parseServerActionResult,
  ChatMessage,
  ChatMessageActionResult,
  ChatMessagesResponse,
  DoneItinerary,
  SendChatMessageDone,
} from '@/api/chatMessages';
import { getItinerary, updateItinerary, ItineraryDetail } from '@/api/itineraries';
import { ChatHeader } from '@/components/ChatHeader';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatActionResultCard } from '@/components/ChatActionResultCard';
import { TypeMessageWindow } from '@/components/TypeMessageWindow';
import { NavigationDrawer } from '@/components/ui/NavigationDrawer';
import { OverflowMenu } from '@/components/ui/OverflowMenu';
import { RenameChatModal } from '@/components/RenameChatModal';
import { TripInfoBottomSheet, TripInfo } from '@/components/ui/TripInfoBottomSheet';
import { Alert } from '@/components/ui/Alert';
import { BOTTOM_NAVIGATION, CHAT_HEADER_HEIGHT } from '@/constants/layout';
import { Typography } from '@/constants/theme';

type Props = { chatId: string };
type DisplayMessage = ChatMessage;

type PendingChatState = {
  isSending: boolean;
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
  lastChunkAt?: number;
};

const RESULT_PREPARING_DELAY_MS = 1500;

function toActionResult(done: {
  itinerary?: SendChatMessageDone['itinerary'];
  change?: SendChatMessageDone['change'];
  reservation?: SendChatMessageDone['reservation'];
  cancel?: SendChatMessageDone['cancel'];
}): ChatMessageActionResult | undefined {
  if (done.itinerary) return { type: 'itinerary', data: done.itinerary };
  if (done.change) return { type: 'change', data: done.change };
  if (done.reservation) return { type: 'reservation', data: done.reservation };
  if (done.cancel) return { type: 'cancel', data: done.cancel };
  return undefined;
}

function attachDoneResultToAssistantMessage(done: SendChatMessageDone): DisplayMessage {
  return {
    ...done.assistantMessage,
    actionResult: toActionResult(done),
  };
}

function formatTimestamp(isoString: string): string {
  return formatKoreanTime(isoString);
}

function mergeDoneItinerary(old: ItineraryDetail | undefined, itinerary: DoneItinerary) {
  if (!old) return old;

  return {
    ...old,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
    totalDays: Object.keys(itinerary.dayPlans).length,
    updatedAt: itinerary.updatedAt,
    dayPlans: Object.fromEntries(
      Object.entries(itinerary.dayPlans).map(([date, plans]) => [
        date,
        plans.map((plan, index) => ({
          index: plan.index ?? index,
          plan_name: plan.plan_name,
          time: plan.time,
          place: plan.place,
          note: plan.note,
          status: plan.status,
          cost: plan.cost ?? null,
        })),
      ]),
    ),
  };
}

export function ChatRoomScreen({ chatId }: Props) {
  const { colors } = useTheme();
  const { authRequest } = useApi();
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedRef = useRef(false);
  const roomNameRef = useRef('채팅방');
  const insets = useSafeAreaInsets();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [editTripInfoVisible, setEditTripInfoVisible] = useState(false);
  const [overflowPosition, setOverflowPosition] = useState({
    top: CHAT_HEADER_HEIGHT + insets.top - 8,
    right: 16,
  });
  const [thinkingDotCount, setThinkingDotCount] = useState(1);
  const [showResultPreparing, setShowResultPreparing] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(chatId);
  const deletedChatIdsRef = useRef(new Set<string>());
  const pendingDrawerActionRef = useRef<(() => void) | null>(null);

  const { data: roomData, error: roomError } = useQuery({
    queryKey: queryKeys.chatRooms.detail(chatId),
    queryFn: () => authRequest((token) => getChatRoom(token, chatId)),
    staleTime: STALE_TIMES.chatRooms.detail,
    gcTime: GC_TIMES.chatRooms.detail,
  });

  const { data: messagesData, error: messagesError, isLoading: messagesLoading } = useQuery({
    queryKey: queryKeys.chatRooms.messages(chatId),
    queryFn: async () => {
      try {
        return await authRequest((token) => getChatMessages(token, chatId));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404 && roomData) {
          return {
            roomId: chatId,
            messages: [],
            nextCursor: null,
            hasMore: false,
          } satisfies ChatMessagesResponse;
        }
        throw error;
      }
    },
    enabled: !!roomData,
    staleTime: STALE_TIMES.chatRooms.messages,
    gcTime: GC_TIMES.chatRooms.messages,
  });

  const { data: pendingChat = null } = useQuery({
    queryKey: queryKeys.chatRooms.pending(chatId),
    queryFn: () => null as PendingChatState | null,
    staleTime: Infinity,
    gcTime: GC_TIMES.chatRooms.pending,
  });

  const { data: chatRoomsData } = useQuery({
    queryKey: queryKeys.chatRooms.all,
    queryFn: () => authRequest(getChatRooms),
    staleTime: STALE_TIMES.chatRooms.all,
  });

  const { data: selectedRoomData } = useQuery({
    queryKey: queryKeys.chatRooms.detail(selectedChatId),
    queryFn: () => authRequest((token) => getChatRoom(token, selectedChatId)),
    enabled: selectedChatId !== chatId,
    staleTime: STALE_TIMES.chatRooms.detail,
    gcTime: GC_TIMES.chatRooms.detail,
  });

  const activeRoomData = selectedChatId === chatId ? roomData : selectedRoomData;
  const activeItineraryId = activeRoomData?.itineraryId ?? '';

  const { data: itineraryDetail } = useQuery({
    queryKey: queryKeys.itineraries.detail(activeItineraryId),
    queryFn: () => authRequest((token) => getItinerary(token, activeItineraryId)),
    enabled: !!activeItineraryId,
    staleTime: STALE_TIMES.itineraries.detail,
    gcTime: GC_TIMES.itineraries.detail,
  });

  const tripInfoInitialValues = useMemo(
    () => (itineraryDetail ? toTripInfoInitialValues(itineraryDetail) : undefined),
    [itineraryDetail],
  );

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    roomNameRef.current =
      roomData?.name ??
      chatRoomsData?.rooms.find((room) => room.roomId === chatId)?.name ??
      '채팅방';
  }, [chatId, chatRoomsData, roomData]);

  useEffect(() => {
    if (!roomError) return;
    if (deletedChatIdsRef.current.has(chatId)) return;
    if (axios.isAxiosError(roomError) && roomError.response?.status === 404 && roomData) return;
    Toast.show({ type: 'error', text1: getErrorMessage(roomError) });
  }, [chatId, roomData, roomError]);

  useEffect(() => {
    if (!messagesError) return;
    if (deletedChatIdsRef.current.has(chatId)) return;
    if (axios.isAxiosError(messagesError) && messagesError.response?.status === 404 && roomData) return;
    Toast.show({ type: 'error', text1: getErrorMessage(messagesError) });
  }, [chatId, messagesError, roomData]);

  useEffect(() => {
    if (!pendingChat?.isSending) {
      setThinkingDotCount(1);
      return;
    }

    const intervalId = setInterval(() => {
      setThinkingDotCount((count) => (count % 3) + 1);
    }, 450);

    return () => clearInterval(intervalId);
  }, [pendingChat]);

  useEffect(() => {
    if (!pendingChat?.isSending || !pendingChat.assistantMessage?.content || !pendingChat.lastChunkAt) {
      setShowResultPreparing(false);
      return;
    }

    setShowResultPreparing(false);
    const timerId = setTimeout(() => {
      setShowResultPreparing(true);
    }, RESULT_PREPARING_DELAY_MS);

    return () => clearTimeout(timerId);
  }, [pendingChat?.isSending, pendingChat?.assistantMessage?.content, pendingChat?.lastChunkAt]);

  const deleteMutation = useMutation({
    mutationFn: (roomId: string) => authRequest((token) => deleteChatRoom(token, roomId)),
    onSuccess: (_, roomId) => {
      deletedChatIdsRef.current.add(roomId);
      queryClient.setQueryData<{ rooms: { roomId: string }[] }>(
        queryKeys.chatRooms.all,
        (old) => old ? { ...old, rooms: old.rooms.filter((room) => room.roomId !== roomId) } : old,
      );
      queryClient.removeQueries({ queryKey: queryKeys.chatRooms.pending(roomId) });
      if (roomId !== chatId) {
        queryClient.removeQueries({ queryKey: queryKeys.chatRooms.detail(roomId) });
        queryClient.removeQueries({ queryKey: queryKeys.chatRooms.messages(roomId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
      Toast.show({ type: 'success', text1: '채팅방이 삭제되었습니다.' });
      if (roomId === chatId) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/chat');
        }
      }
    },
    onError: (error, roomId) => {
      deletedChatIdsRef.current.delete(roomId);
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

  const handleSend = useCallback(
    async (message: string) => {
      const pendingKey = queryKeys.chatRooms.pending(chatId);
      const currentPending = queryClient.getQueryData<PendingChatState>(pendingKey);
      if (currentPending?.isSending) return;

      const now = new Date().toISOString();
      queryClient.setQueryData<PendingChatState>(pendingKey, {
        isSending: true,
        userMessage: {
          messageId: '__pending_user',
          role: 'user',
          content: message,
          createdAt: now,
        },
      });

      try {
        const token = await getToken();
        if (!token) throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');

        await sendChatMessageStream(token, chatId, { content: message }, {
          onChunk: (chunk) => {
            queryClient.setQueryData<PendingChatState>(pendingKey, (old) => {
              if (!old) return old;
              const assistantMessage = old.assistantMessage
                ? { ...old.assistantMessage, content: old.assistantMessage.content + chunk.content }
                : {
                  messageId: '__streaming_ai',
                  role: 'assistant' as const,
                  content: chunk.content,
                  createdAt: new Date().toISOString(),
                };

              return { ...old, assistantMessage, lastChunkAt: Date.now() };
            });
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 0);
          },
          onDone: (done) => {
            const assistantMessage = attachDoneResultToAssistantMessage(done);

            if (done.itinerary) {
              queryClient.setQueryData<ItineraryDetail>(
                queryKeys.itineraries.detail(done.itinerary.itineraryId),
                (old) => mergeDoneItinerary(old, done.itinerary!),
              );
            }

            queryClient.setQueryData<ChatMessagesResponse>(
              queryKeys.chatRooms.messages(chatId),
              (old) => {
                if (!old) {
                  return {
                    roomId: chatId,
                    messages: [assistantMessage, done.userMessage],
                    nextCursor: null,
                    hasMore: false,
                  };
                }
                const nextIds = new Set([done.assistantMessage.messageId, done.userMessage.messageId]);
                return {
                  ...old,
                  messages: [
                    assistantMessage,
                    done.userMessage,
                    ...old.messages.filter((msg) => !nextIds.has(msg.messageId)),
                  ],
                };
              },
            );
            queryClient.setQueryData<PendingChatState | null>(pendingKey, null);

            queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms.all, exact: true });

            if (done.itinerary) {
              queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
            }

            if (done.change) {
              queryClient.invalidateQueries({ queryKey: queryKeys.itineraries.all });
              queryClient.invalidateQueries({
                queryKey: queryKeys.itineraries.detail(done.change.itineraryId),
              });
            }

            if (!focusedRef.current) {
              Toast.show({
                type: 'success',
                text1: 'AI 응답이 완료되었습니다.',
                text2: `${roomNameRef.current}에서 새 응답이 도착했습니다.`,
              });
            }
          },
        });
      } catch (e) {
        queryClient.setQueryData<PendingChatState | null>(pendingKey, null);
        Toast.show({ type: 'error', text1: getErrorMessage(e) });
      }
    },
    [chatId, getToken, queryClient],
  );

  const displayMessages = useMemo(() => {
    const serverMessages: DisplayMessage[] = [...(messagesData?.messages ?? [])]
      .reverse()
      .map((message) => ({
        ...message,
        actionResult: parseServerActionResult(message.actionResult),
      }));
    const pendingMessages = pendingChat
      ? [pendingChat.userMessage, pendingChat.assistantMessage].filter(Boolean) as DisplayMessage[]
      : [];

    return [...serverMessages, ...pendingMessages];
  }, [messagesData, pendingChat]);

  useEffect(() => {
    if (messagesLoading) return;
    const timerId = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 50);

    return () => clearTimeout(timerId);
  }, [displayMessages.length, messagesLoading]);

  const chatRooms = chatRoomsData?.rooms ?? [];
  const selectedChatName = activeRoomData?.name ?? '';
  const bottomOffset = BOTTOM_NAVIGATION + insets.bottom;
  const scrollToLatestMessage = useCallback((animated = false) => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated }), 0);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated }), 250);
  }, []);

  const closeDrawerThen = (action?: () => void) => {
    pendingDrawerActionRef.current = action ?? null;
    setDrawerVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <ChatHeader
        variant="active"
        title={roomData?.name}
        onDrawerOpen={() => setDrawerVisible(true)}
        onOverflowOpen={() => {
          Keyboard.dismiss();
          setSelectedChatId(chatId);
          setOverflowPosition({ top: CHAT_HEADER_HEIGHT + insets.top - 16, right: 16 });
          setOverflowVisible(true);
        }}
      />

      {/* spacer는 KAV 밖에 두어야 keyboard offset 계산에서 이중으로 더해지지 않음 */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
        >
          {messagesLoading ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color={colors.textCaption} />
            </View>
          ) : (
            displayMessages.map((msg) => (
              <View key={msg.messageId}>
                <ChatBubble
                  variant={msg.role === 'user' ? 'user' : 'ai'}
                  message={msg.content}
                  timestamp={formatTimestamp(msg.createdAt)}
                />
                {msg.actionResult && <ChatActionResultCard result={msg.actionResult} />}
              </View>
            ))
          )}

          {pendingChat?.isSending && !pendingChat.assistantMessage?.content && (
            <ChatBubble
              variant="ai"
              message={`AI가 열심히 생각 중입니다${'.'.repeat(thinkingDotCount)}`}
              timestamp={formatTimestamp(new Date().toISOString())}
              hideTimestamp
            />
          )}
          {pendingChat?.isSending && pendingChat.assistantMessage?.content && showResultPreparing && (
            <ChatBubble
              variant="ai"
              message={`보기 좋게 정리하는 중입니다${'.'.repeat(thinkingDotCount)}`}
              timestamp={formatTimestamp(new Date().toISOString())}
              hideTimestamp
            />
          )}
          <Text style={[styles.aiNotice, { color: colors.textCaption }]}>
            AI는 실수를 할 수 있습니다. 비용, 위치 등 중요한 정보는 다시 한번 확인해 주세요.
          </Text>
        </ScrollView>

        <TypeMessageWindow
          onSend={handleSend}
          onFocus={() => scrollToLatestMessage(true)}
          disabled={!!pendingChat?.isSending}
        />
      </KeyboardAvoidingView>
      <View style={{ height: bottomOffset }} />

      <NavigationDrawer
        visible={drawerVisible}
        chats={chatRooms.map((room) => ({ id: room.roomId, title: room.name }))}
        activeChatId={chatId}
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
            if (String(id) !== chatId) {
              router.replace({ pathname: '/chat/[chatId]', params: { chatId: String(id) } });
            }
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
          closeDrawerThen(async () => {
            try {
              const room = await queryClient.fetchQuery({
                queryKey: queryKeys.chatRooms.detail(String(id)),
                queryFn: () => authRequest((token) => getChatRoom(token, String(id))),
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
        onChatDelete={(id) => {
          setSelectedChatId(String(id));
          closeDrawerThen(() => setDeleteAlertVisible(true));
        }}
      />

      <OverflowMenu
        visible={overflowVisible}
        position={overflowPosition}
        onClose={() => {
          Keyboard.dismiss();
          setOverflowVisible(false);
        }}
        onRename={() => {
          Keyboard.dismiss();
          setOverflowVisible(false);
          setTimeout(() => setRenameModalVisible(true), 250);
        }}
        onEditInfo={() => {
          Keyboard.dismiss();
          setOverflowVisible(false);
          setEditTripInfoVisible(true);
        }}
        onViewPlan={() => {
          Keyboard.dismiss();
          setOverflowVisible(false);
          if (activeRoomData?.itineraryId) {
            router.push({ pathname: '/plan-list/[id]', params: { id: activeRoomData.itineraryId } });
          } else {
            router.navigate('/plan-list');
          }
        }}
        onDelete={() => {
          Keyboard.dismiss();
          setOverflowVisible(false);
          setDeleteAlertVisible(true);
        }}
      />

      <RenameChatModal
        visible={renameModalVisible}
        initialName={selectedChatName}
        onSave={(name) => {
          if (!name.trim()) return;
          renameMutation.mutate({ roomId: selectedChatId, name: name.trim() });
        }}
        onCancel={() => setRenameModalVisible(false)}
      />

      <TripInfoBottomSheet
        visible={editTripInfoVisible}
        mode="edit"
        initialValues={tripInfoInitialValues}
        roomName={selectedChatId !== chatId ? selectedChatName : undefined}
        onSubmit={(info) => updateTripInfoMutation.mutate({ info, itineraryId: activeItineraryId })}
        onClose={() => setEditTripInfoVisible(false)}
      />

      <Alert
        visible={deleteAlertVisible}
        title={AlertMessages.deleteChat.title}
        message={AlertMessages.deleteChat.message}
        confirmLabel={AlertMessages.deleteChat.confirmLabel}
        onConfirm={() => {
          const roomId = selectedChatId;
          deletedChatIdsRef.current.add(roomId);
          setDeleteAlertVisible(false);
          if (roomId !== chatId) {
            setSelectedChatId(chatId);
          }
          deleteMutation.mutate(roomId);
        }}
        onCancel={() => setDeleteAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  messageList: { flex: 1 },
  messageListContent: { paddingTop: 16, paddingBottom: 8 },
  aiNotice: {
    ...Typography['caption'],
    alignSelf: 'stretch',
    paddingHorizontal: 32,
    paddingTop: 0,
    paddingBottom: 4,
    textAlign: 'center',
  },
  loadingIndicator: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
