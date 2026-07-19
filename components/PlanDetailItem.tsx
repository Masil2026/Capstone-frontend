import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius, Elevation, Typography } from '@/constants/theme';
import IcPin from '@/assets/icons/ic_pin.svg';
import IcPrice from '@/assets/icons/ic_price.svg';
import IcExternalLink from '@/assets/icons/ic_external_link.svg';
import IcChevronDown from '@/assets/icons/ic_chevron_down.svg';
import IcAirplane from '@/assets/icons/ic_airplane.svg';
import IcLodging from '@/assets/icons/ic_lodging.svg';

type FlightReservationDetail = {
  airline?: string;
  flight_no?: string;
  departure?: {
    airport?: string;
  };
  arrival?: {
    airport?: string;
  };
};

type HotelReservationDetail = {
  hotel_name?: string;
  room_type?: string;
  guests?: number;
};

type RentalCarReservationDetail = {
  company?: string;
  car_model?: string;
  pickup?: {
    location?: string;
  };
};

type ReservationKind = 'flight' | 'hotel' | 'rental_car';
type ReservationDetail = FlightReservationDetail | HotelReservationDetail | RentalCarReservationDetail;
type ReservationIcon = React.FC<{ width: number; height: number; color: string }>;

type Props = {
  title: string;
  startTime: string;
  endTime: string;
  memo?: string;
  location?: string;
  price?: number;
  reservationType?: ReservationKind;
  detail?: ReservationDetail;
  totalPrice?: number;
  currency?: string;
  bookingUrl?: string;
  imageUrl?: string | null;
  showConnector?: boolean;
  defaultOpen?: boolean;
};

function formatPrice(price?: number, currency?: string): string | undefined {
  if (price === undefined) return undefined;
  const formatted = price.toLocaleString('ko-KR');
  return currency === 'KRW' || !currency ? `${formatted}원` : `${formatted} ${currency}`;
}

function isFlightDetail(detail?: ReservationDetail): detail is FlightReservationDetail {
  return !!detail && ('airline' in detail || 'flight_no' in detail || 'departure' in detail || 'arrival' in detail);
}

function isHotelDetail(detail?: ReservationDetail): detail is HotelReservationDetail {
  return !!detail && ('hotel_name' in detail || 'room_type' in detail || 'guests' in detail);
}

function isRentalCarDetail(detail?: ReservationDetail): detail is RentalCarReservationDetail {
  return !!detail && ('company' in detail || 'car_model' in detail || 'pickup' in detail);
}

function getReservationKind(reservationType?: ReservationKind, detail?: ReservationDetail): ReservationKind | undefined {
  if (reservationType) return reservationType;
  if (isFlightDetail(detail)) return 'flight';
  if (isHotelDetail(detail)) return 'hotel';
  if (isRentalCarDetail(detail)) return 'rental_car';
  return undefined;
}

function getReservationSummary(reservationType?: ReservationKind, detail?: ReservationDetail): string | undefined {
  const reservationKind = getReservationKind(reservationType, detail);

  if (reservationKind === 'flight') {
    const flight = isFlightDetail(detail) ? detail : undefined;
    return [flight?.airline, flight?.flight_no].filter(Boolean).join(' ');
  }

  if (reservationKind === 'hotel') {
    const hotel = isHotelDetail(detail) ? detail : undefined;
    return hotel?.hotel_name;
  }

  if (reservationKind === 'rental_car') {
    const rentalCar = isRentalCarDetail(detail) ? detail : undefined;
    return [rentalCar?.company, rentalCar?.car_model].filter(Boolean).join(' · ');
  }

  return undefined;
}

function getDetailLocation(
  reservationType?: ReservationKind,
  detail?: ReservationDetail,
  fallbackLocation?: string
): string | undefined {
  const reservationKind = getReservationKind(reservationType, detail);

  if (reservationKind === 'flight' && isFlightDetail(detail)) {
    return [detail.departure?.airport, detail.arrival?.airport].filter(Boolean).join(' → ');
  }

  if (reservationKind === 'hotel' && isHotelDetail(detail)) {
    return [
      detail.room_type,
      detail.guests ? `투숙객 ${detail.guests}명` : undefined,
    ].filter(Boolean).join(' · ');
  }

  if (reservationKind === 'rental_car' && isRentalCarDetail(detail)) {
    return detail.pickup?.location;
  }

  return fallbackLocation;
}

function getDetailIcon(reservationType?: ReservationKind, detail?: ReservationDetail): ReservationIcon {
  const reservationKind = getReservationKind(reservationType, detail);

  if (reservationKind === 'flight') return IcAirplane;
  if (reservationKind === 'hotel') return IcLodging;
  return IcPin;
}

export function PlanDetailItem({
  title,
  startTime,
  endTime,
  memo,
  location,
  price,
  reservationType,
  detail,
  totalPrice,
  currency,
  bookingUrl,
  imageUrl,
  showConnector = true,
  defaultOpen = false,
}: Props) {
  const { colors, scheme } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const chevronRotation = useSharedValue(defaultOpen ? 180 : 0);

  const animatedChevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const reservationSummary = getReservationSummary(reservationType, detail);
  const detailLocation = getDetailLocation(reservationType, detail, location);
  const DetailIcon = getDetailIcon(reservationType, detail);
  const displayPrice = formatPrice(totalPrice ?? price, currency);
  const chevronColor = isOpen ? colors.textTitle : colors.textCaption;

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  const openBooking = () => {
    if (!bookingUrl) return;
    Linking.openURL(bookingUrl);
  };

  return (
    <View style={[styles.container, isOpen && styles.openContainer]}>
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: colors.textSub }]} />
        <Text style={[styles.timeText, { color: colors.textCaption }]}>{startTime}</Text>
        <Text style={[styles.timeText, { color: colors.textCaption }]}>~</Text>
        <Text style={[styles.timeText, { color: colors.textCaption }]}>{endTime}</Text>
        {showConnector ? (
          <View style={[styles.connector, { backgroundColor: colors.divider }]} />
        ) : null}
      </View>

      <Pressable onPress={handleToggle} style={styles.cardPressable}>
        {({ pressed }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.divider },
              isOpen ? Elevation[scheme][2] : Elevation[scheme][1],
            ]}
          >
            <View style={[styles.header, isOpen && styles.openHeader]}>
              <Text style={[styles.title, { color: colors.textTitle }]} numberOfLines={isOpen ? undefined : 2}>
                {title}
              </Text>
              <Animated.View style={animatedChevron}>
                <IcChevronDown width={20} height={20} color={chevronColor} />
              </Animated.View>
            </View>

            {isOpen ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                <View style={styles.expanded}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.image}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : null}
                  {reservationSummary ? (
                    <Text style={[styles.detailTitle, { color: colors.textTitle }]}>
                      {reservationSummary}
                    </Text>
                  ) : null}
                  {memo ? (
                    <Text style={[styles.detailTitle, { color: colors.textTitle }]}>
                      {memo}
                    </Text>
                  ) : null}
                  {detailLocation ? (
                    <View style={styles.iconRow}>
                      <DetailIcon width={16} height={16} color={colors.textCaption} />
                      <Text style={[styles.detailText, { color: colors.textCaption }]}>
                        {detailLocation}
                      </Text>
                    </View>
                  ) : null}
                  {displayPrice ? (
                    <View style={styles.iconRow}>
                      <IcPrice width={16} height={16} color={colors.textCaption} />
                      <Text style={[styles.detailText, { color: colors.textCaption }]}>
                        {displayPrice}
                      </Text>
                    </View>
                  ) : null}
                  {bookingUrl ? (
                    <Pressable onPress={openBooking} style={styles.linkPressable}>
                      {({ pressed: linkPressed }) => (
                        <>
                          <View style={styles.iconRow}>
                            <IcExternalLink width={16} height={16} color={colors.primary} />
                            <Text style={[styles.linkText, { color: colors.primary }]}>예약 확인하기</Text>
                          </View>
                          {linkPressed ? (
                            <View
                              style={[
                                StyleSheet.absoluteFill,
                                styles.linkOverlay,
                                { backgroundColor: colors.pressOverlay },
                              ]}
                            />
                          ) : null}
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
            {pressed ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.cardOverlay,
                  { backgroundColor: colors.pressOverlay },
                ]}
              />
            ) : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
  },
  openContainer: {
    marginBottom: 8,
  },
  timeline: {
    width: 44,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    marginBottom: 8,
  },
  timeText: {
    ...Typography['body-md'],
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 40,
    marginTop: 8,
  },
  cardPressable: {
    flex: 1,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openHeader: {
    marginBottom: 6,
  },
  title: {
    ...Typography['heading-md'],
    flex: 1,
  },
  expanded: {
    gap: 10,
    paddingLeft: 8,
    paddingRight: 4,
    paddingTop: 6,
  },
  divider: {
    height: 1,
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: BorderRadius.md,
  },
  detailTitle: {
    ...Typography['heading-md'],
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    ...Typography['body-md'],
    flex: 1,
  },
  linkPressable: {
    alignSelf: 'flex-start',
  },
  linkText: {
    ...Typography['body-md'],
  },
  linkOverlay: {
    borderRadius: BorderRadius.xs,
  },
  cardOverlay: {
    borderRadius: BorderRadius.md,
  },
});
