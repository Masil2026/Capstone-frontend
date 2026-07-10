import { apiClient } from './client';

const BASE = '/api/v1/chat-rooms';

type ChatRoomPreferences = {
  budget: string;
  style: string;
};

type ChatRoom = {
  roomId: string;
  name: string;
  clerkId: string;
  aiSummary: string | null;
  preferences: ChatRoomPreferences | null;
  createdAt: string;
  updatedAt: string;
};

type ChatRoomsResponse = {
  rooms: ChatRoom[];
};

type ChatRoomDetail = {
  roomId: string;
  name: string;
  clerkId: string;
  aiSummary: string | null;
  preferences: ChatRoomPreferences | null;
  itineraryId: string;
  createdAt: string;
  updatedAt: string;
};

type TripDestinationRequest = {
  city: string;
  start_date: string;
  end_date: string;
};

type OriginRequest = {
  city: string;
};

type CreateChatRoomRequest = {
  origin: OriginRequest;
  destinations: TripDestinationRequest[];
  budget?: number;
  adultCount: number;
  childCount: number;
  childAges: number[];
};

type CreatedChatRoom = {
  roomId: string;
  name: string;
  itineraryId: string;
  clerkId: string;
  createdAt: string;
  updatedAt: string;
};

type DeletedChatRoom = {
  roomId: string;
  deleted: boolean;
};

type UpdateChatRoomNameRequest = {
  name: string;
};

type UpdatedChatRoomName = {
  roomId: string;
  name: string;
  updatedAt: string;
};

export const getChatRooms = (token: string) =>
  apiClient.get<ChatRoomsResponse>(BASE, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getChatRoom = (token: string, roomId: string) =>
  apiClient.get<ChatRoomDetail>(`${BASE}/${roomId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createChatRoom = (token: string, body: CreateChatRoomRequest) =>
  apiClient.post<CreatedChatRoom>(BASE, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteChatRoom = (token: string, roomId: string) =>
  apiClient.delete<DeletedChatRoom>(`${BASE}/${roomId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateChatRoomName = (token: string, roomId: string, body: UpdateChatRoomNameRequest) =>
  apiClient.patch<UpdatedChatRoomName>(`${BASE}/${roomId}/name`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
