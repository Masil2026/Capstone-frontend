import { apiClient } from './client';

const BASE = '/api/v1/itineraries';

type OriginItem = {
  city: string;
};

type Itinerary = {
  itineraryId: string;
  name: string;
  status: 'draft' | 'completed';
  origin: OriginItem;
  destinations: TripDestination[];
  totalDays: number;
  startDate: string;
};

type GetItinerariesResponse = {
  itineraries: Itinerary[];
};

type TripDestination = {
  city: string;
  start_date: string;
  end_date: string;
};

export type DayPlanItem = {
  index: number;
  plan_name: string;
  time: string;
  place: string;
  note: string;
  cost?: DayPlanCost | null;
  image_url?: string | null;
  url?: string | null;
  status: string;
};

export type DayPlanCost = {
  amount: number;
  currency: string;
  amount_krw: number | null;
};

export type ItineraryDetail = {
  itineraryId: string;
  name: string;
  status: 'draft' | 'completed';
  origin: OriginItem;
  destinations: TripDestination[];
  budget: number | null;
  adultCount: number;
  childCount: number;
  childAges: number[];
  totalDays: number;
  startDate: string;
  endDate: string;
  dayPlans: Record<string, DayPlanItem[]>;
  createdAt: string;
  updatedAt: string;
};

export const getItineraries = (token: string) =>
  apiClient.get<GetItinerariesResponse>(BASE, {
    headers: { Authorization: `Bearer ${token}` },
  });

type UpdateItineraryRequest = {
  origin?: OriginItem;
  destinations?: TripDestination[];
  budget?: number | null;
  adultCount?: number;
  childCount?: number;
  childAges?: number[];
};

type UpdateItineraryResponse = {
  itineraryId: string;
  origin: OriginItem;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  budget: number | null;
  adultCount: number;
  childCount: number;
  childAges: number[];
  updatedAt: string;
};

export const getItinerary = (token: string, itineraryId: string) =>
  apiClient.get<ItineraryDetail>(`${BASE}/${itineraryId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

type DayPlanItemInput = {
  plan_name: string;
  time: string;
  place: string;
  note?: string;
  cost?: DayPlanCost | null;
};

type UpdateDayPlansRequest = {
  dayPlans: Record<string, DayPlanItemInput[]>;
};

type UpdateDayPlansResponse = {
  itineraryId: string;
  dayPlans: Record<string, DayPlanItem[]>;
  updatedAt: string;
};

export const updateItinerary = (token: string, itineraryId: string, body: UpdateItineraryRequest) =>
  apiClient.patch<UpdateItineraryResponse>(`${BASE}/${itineraryId}`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

type UpdateItemStatusRequest = {
  date: string;
  index: number;
  status: 'todo' | 'done';
};

type UpdateItemStatusResponse = {
  itineraryId: string;
  date: string;
  index: number;
  status: 'todo' | 'done';
  updatedAt: string;
};

export const updateDayPlans = (token: string, itineraryId: string, body: UpdateDayPlansRequest) =>
  apiClient.patch<UpdateDayPlansResponse>(`${BASE}/${itineraryId}/day-plans`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

type LogDayPlanItem = {
  plan_name: string;
  time: string;
  place: string;
  note: string;
  cost?: DayPlanCost | null;
  status: string;
};

type ItineraryLog = {
  logId: string;
  origin: OriginItem | null;
  destination: string;
  budget: number | null;
  adultCount: number;
  childCount: number;
  childAges: number[];
  totalDays: number;
  startDate: string;
  endDate: string;
  dayPlans: Record<string, LogDayPlanItem[]>;
  createdAt: string;
};

type GetItineraryLogsResponse = {
  itineraryId: string;
  logs: ItineraryLog[];
};

export const updateItemStatus = (token: string, itineraryId: string, body: UpdateItemStatusRequest) =>
  apiClient.patch<UpdateItemStatusResponse>(`${BASE}/${itineraryId}/items/status`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

type UpdateItineraryStatusRequest = {
  status: 'draft' | 'completed';
};

type UpdateItineraryStatusResponse = {
  itineraryId: string;
  status: 'draft' | 'completed';
  updatedAt: string;
};

export const getItineraryLogs = (token: string, itineraryId: string) =>
  apiClient.get<GetItineraryLogsResponse>(`${BASE}/${itineraryId}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateItineraryStatus = (token: string, itineraryId: string, body: UpdateItineraryStatusRequest) =>
  apiClient.patch<UpdateItineraryStatusResponse>(`${BASE}/${itineraryId}/status`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
