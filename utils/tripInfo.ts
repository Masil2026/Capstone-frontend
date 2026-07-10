import { ItineraryDetail } from '@/api/itineraries';
import { TripDestination, TripInfo } from '@/components/ui/TripInfoBottomSheet';
import { formatDateOnly, parseDateOnly } from '@/utils/dateOnly';

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
