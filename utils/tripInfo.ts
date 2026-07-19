import { ItineraryDetail } from '@/api/itineraries';
import { TripDestination, TripInfo } from '@/components/ui/TripInfoBottomSheet';
import type { CalendarEvent } from '@/utils/calendarEvents';
import { addDays, formatDateOnly, parseDateOnly } from '@/utils/dateOnly';

export type TripDestinationRequest = {
  city: string;
  start_date: string;
  end_date: string;
};

export function formatTripDestinations(destinations: TripDestination[]): TripDestinationRequest[] {
  return destinations.map((destination) => ({
    city: destination.destination,
    start_date: formatDateOnly(destination.startDate),
    end_date: formatDateOnly(destination.endDate),
  }));
}

export function formatTripDestinationCities(destinations: { city: string }[]): string {
  return destinations.map((destination) => destination.city).filter(Boolean).join(', ');
}

const PROVINCE_LEVEL_SUFFIXES = ['특별자치도', '특별자치시', '광역시', '특별시'];
const ADMIN_SUFFIXES = ['특별자치도', '특별자치시', '광역시', '특별시', '도', '시', '군', '구'];

function isProvinceLevelToken(token: string): boolean {
  return PROVINCE_LEVEL_SUFFIXES.some((suffix) => token.endsWith(suffix))
    || (token.endsWith('도') && !token.endsWith('자치도'));
}

function stripAdminSuffix(token: string): string {
  const suffix = ADMIN_SUFFIXES.find((candidate) => token.length > candidate.length && token.endsWith(candidate));
  return suffix ? token.slice(0, -suffix.length) : token;
}

/** "대한민국 강원특별자치도 강릉시" -> "강릉" 처럼 국가/광역 단위를 뺀 짧은 지명만 남긴다. */
export function extractShortCityName(rawCity: string): string {
  const withoutCountry = rawCity.replace(/대한민국/g, '');
  const tokens = withoutCountry.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return rawCity.trim();

  const specificTokens = tokens.length > 1 ? tokens.filter((token) => !isProvinceLevelToken(token)) : tokens;
  const candidates = specificTokens.length > 0 ? specificTokens : tokens;

  return stripAdminSuffix(candidates[candidates.length - 1]);
}

function formatCalendarDestinationLabel(destinations: { city: string }[]): string {
  return destinations
    .map((destination) => destination.city)
    .filter(Boolean)
    .map(extractShortCityName)
    .join(', ');
}

export function itineraryToCalendarEvent(item: {
  itineraryId: string;
  startDate: string;
  totalDays: number;
  destinations: { city: string }[];
}): CalendarEvent {
  const startDate = parseDateOnly(item.startDate);

  return {
    id: item.itineraryId,
    startDate,
    endDate: addDays(startDate, item.totalDays - 1),
    label: formatCalendarDestinationLabel(item.destinations),
  };
}

export function toTripInfoInitialValues(detail: Pick<
  ItineraryDetail,
  'origin' | 'destinations' | 'budget' | 'adultCount' | 'childCount' | 'childAges'
>): Partial<TripInfo> {
  return {
    origin: detail.origin.city,
    destinations: detail.destinations.map((destination) => ({
      destination: destination.city,
      startDate: parseDateOnly(destination.start_date),
      endDate: parseDateOnly(destination.end_date),
    })),
    budget: detail.budget != null ? Math.round(detail.budget / 10000) : undefined,
    adults: detail.adultCount,
    children: detail.childCount,
    childAges: detail.childAges.map((n) => `만 ${n}세` as TripInfo['childAges'][number]),
  };
}
