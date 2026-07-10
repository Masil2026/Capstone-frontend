import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Elevation, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import IcChevronDown from '@/assets/icons/ic_chevron_down.svg';
import IcDelete from '@/assets/icons/ic_delete.svg';
import IcPlan from '@/assets/icons/ic_plan.svg';
import IcSearch from '@/assets/icons/ic_search.svg';

type Mode = 'create' | 'edit';

const AGE_OPTIONS = [
  '만 1세',
  '만 2세',
  '만 3세',
  '만 4세',
  '만 5세',
  '만 6세',
  '만 7세',
  '만 8세',
  '만 9세',
  '만 10세',
  '만 11세',
  '만 12세',
] as const;
const MAX_PEOPLE_COUNT = 15;
const MAX_DESTINATION_COUNT = 3;
type AgeOption = (typeof AGE_OPTIONS)[number];

export type TripDestination = {
  destination: string;
  startDate: Date;
  endDate: Date;
};

type TripDestinationDraft = {
  destination: string;
  selectedDestination: string;
  startDate: Date | null;
  endDate: Date | null;
};

export type TripInfo = {
  origin: string;
  destinations: TripDestination[];
  adults: number;
  children: number;
  childAges: AgeOption[];
  budget: number;
};

type Props = {
  visible: boolean;
  mode: Mode;
  initialValues?: Partial<TripInfo>;
  roomName?: string;
  onSubmit: (info: TripInfo) => void;
  onClose: () => void;
};

type CalendarProps = {
  startDate: Date | null;
  endDate: Date | null;
  month: Date;
  minSelectableDate: Date;
  onDayPress: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

type StepperRowProps = {
  label: string;
  value: number;
  min?: number;
  onDecrement: () => void;
  onIncrement: () => void;
};

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type FocusTarget = { kind: 'origin' } | { kind: 'destination'; index: number };

const GOOGLE_MAPS_API_KEY = (
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  ''
).trim();

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function compareDateOnly(a: Date, b: Date): number {
  const aTime = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bTime = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return aTime - bTime;
}

function getTodayDateOnly(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isBetween(date: Date, start: Date, end: Date): boolean {
  const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return dateTime > startTime && dateTime < endTime;
}

function normalizeAges(children: number, ages?: AgeOption[]): (AgeOption | '')[] {
  return Array.from({ length: children }, (_, index) => ages?.[index] ?? '');
}

function normalizeBudget(value?: number): string {
  return value ? String(value) : '';
}

function createEmptyDestination(): TripDestinationDraft {
  return {
    destination: '',
    selectedDestination: '',
    startDate: null,
    endDate: null,
  };
}

function normalizeDestinations(values?: (TripDestinationDraft | TripDestination)[]): TripDestinationDraft[] {
  const destinations = values
    ?.map(value => ({
      destination: value.destination.trim(),
      selectedDestination: ('selectedDestination' in value ? value.selectedDestination.trim() : '') || value.destination.trim(),
      startDate: value.startDate,
      endDate: value.endDate,
    }))
    .filter(value => value.destination || value.startDate || value.endDate) ?? [];
  return destinations.length > 0 ? destinations.slice(0, MAX_DESTINATION_COUNT) : [createEmptyDestination()];
}

function isSameDateValue(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return isSameDay(a, b);
}

function areSameAges(a: (AgeOption | '')[], b: (AgeOption | '')[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function areSameDestinations(a: TripDestinationDraft[], b: TripDestinationDraft[]): boolean {
  const normalizedA = normalizeDestinations(a);
  const normalizedB = normalizeDestinations(b);
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((value, index) => (
    value.destination.trim() === normalizedB[index].destination.trim() &&
    value.selectedDestination.trim() === normalizedB[index].selectedDestination.trim() &&
    isSameDateValue(value.startDate, normalizedB[index].startDate) &&
    isSameDateValue(value.endDate, normalizedB[index].endDate)
  ));
}

function Calendar({ startDate, endDate, month, minSelectableDate, onDayPress, onPrevMonth, onNextMonth }: CalendarProps) {
  const { colors, scheme } = useTheme();
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, mon, index + 1)),
  ];
  const weeks: (Date | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <View style={[styles.calendarPanel, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={onPrevMonth} style={styles.calendarNavButton}>
          {({ pressed }) => (
            <>
              <View style={styles.chevronLeft}>
                <IcChevronDown width={18} height={18} color={colors.textCaption} />
              </View>
              {pressed && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
        <Text style={[styles.calendarMonth, { color: colors.textTitle }]}>
          {year}년 {mon + 1}월
        </Text>
        <Pressable onPress={onNextMonth} style={styles.calendarNavButton}>
          {({ pressed }) => (
            <>
              <View style={styles.chevronRight}>
                <IcChevronDown width={18} height={18} color={colors.textCaption} />
              </View>
              {pressed && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.calendarRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <Text key={day} style={[styles.calendarDayHeader, { color: colors.textCaption }]}>
            {day}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarRow}>
          {week.map((day, dayIndex) => {
            if (!day) return <View key={dayIndex} style={styles.calendarCell} />;

            const isStart = !!startDate && isSameDay(day, startDate);
            const isEnd = !!endDate && isSameDay(day, endDate);
            const inRange = !!startDate && !!endDate && isBetween(day, startDate, endDate);
            const isSelected = isStart || isEnd;
            const isDisabled = compareDateOnly(day, minSelectableDate) < 0 && !isSelected;
            const isFirstRangeDay =
              inRange &&
              !!startDate &&
              isSameDay(day, new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1));
            const isLastRangeDay =
              inRange &&
              !!endDate &&
              isSameDay(day, new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1));

            return (
              <Pressable
                key={dayIndex}
                disabled={isDisabled}
                onPress={() => onDayPress(day)}
                style={styles.calendarCell}
              >
                {({ pressed }) => (
                  <>
                    {inRange && (
                      <View
                        style={[
                          styles.calendarRangeBackground,
                          { backgroundColor: colors.primaryTint },
                          isFirstRangeDay && styles.calendarRangeStart,
                          isLastRangeDay && styles.calendarRangeEnd,
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.calendarDay,
                        isSelected && { backgroundColor: colors.primary },
                        pressed && !isSelected && !isDisabled && { backgroundColor: colors.pressOverlay },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: isSelected ? colors.pageBg : isDisabled ? colors.textDisabled : colors.textTitle },
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function StepperRow({ label, value, min = 0, onDecrement, onIncrement }: StepperRowProps) {
  const { colors } = useTheme();
  const canDecrement = value > min;

  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.stepperLabel, { color: colors.textTitle }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          disabled={!canDecrement}
          onPress={onDecrement}
          style={[styles.stepperButton, { borderColor: colors.divider, backgroundColor: colors.cardBg }]}
        >
          {({ pressed }) => (
            <>
              <Text style={[styles.stepperIcon, { color: canDecrement ? colors.textCaption : colors.textDisabled }]}>-</Text>
              {pressed && canDecrement && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
        <Text style={[styles.stepperValue, { color: colors.textTitle }]}>{value}</Text>
        <Pressable
          onPress={onIncrement}
          style={[styles.stepperButton, { borderColor: colors.divider, backgroundColor: colors.cardBg }]}
        >
          {({ pressed }) => (
            <>
              <Text style={[styles.stepperIcon, { color: colors.textCaption }]}>+</Text>
              {pressed && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
              )}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

type PlaceAutocompletePanelProps = {
  loading: boolean;
  predictions: PlacePrediction[];
  onSelect: (place: PlacePrediction) => void;
};

function PlaceAutocompletePanel({ loading, predictions, onSelect }: PlaceAutocompletePanelProps) {
  const { colors, scheme } = useTheme();

  return (
    <View style={[styles.placePanel, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
      {loading ? (
        <Text style={[styles.placeMetaText, { color: colors.textCaption }]}>검색 중</Text>
      ) : (
        predictions.map((place, placeIndex) => (
          <Pressable
            key={place.place_id}
            onPress={() => onSelect(place)}
            style={[
              styles.placeOption,
              placeIndex < predictions.length - 1 && { borderBottomColor: colors.divider, borderBottomWidth: 1 },
            ]}
          >
            {({ pressed }) => (
              <>
                <Text style={[styles.placeMainText, { color: colors.textTitle }]} numberOfLines={1}>
                  {place.structured_formatting?.main_text ?? place.description}
                </Text>
                {place.structured_formatting?.secondary_text ? (
                  <Text style={[styles.placeSubText, { color: colors.textCaption }]} numberOfLines={1}>
                    {place.structured_formatting.secondary_text}
                  </Text>
                ) : null}
                {pressed && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay }]} />
                )}
              </>
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}

export function TripInfoBottomSheet({ visible, mode, initialValues, roomName, onSubmit, onClose }: Props) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const destinationInputRefs = useRef<(TextInput | null)[]>([]);
  const originInputRef = useRef<TextInput | null>(null);

  const SNAP_HALF = useMemo(() => screenHeight * 0.60, [screenHeight]);
  const SNAP_FULL = useMemo(() => screenHeight * 0.92, [screenHeight]);

  const sheetHeightAnim = useRef(new Animated.Value(0)).current;
  const scrimOpacityAnim = useRef(new Animated.Value(0)).current;
  const snapRef = useRef<'half' | 'full'>('half');
  const dragStartHeight = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [origin, setOrigin] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [destinations, setDestinations] = useState<TripDestinationDraft[]>([createEmptyDestination()]);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<(AgeOption | '')[]>([]);
  const [budget, setBudget] = useState('');
  const [activeCalendarIndex, setActiveCalendarIndex] = useState<number | null>(null);
  const [peopleExpanded, setPeopleExpanded] = useState(false);
  const [activeAgeDropdown, setActiveAgeDropdown] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [budgetFocused, setBudgetFocused] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusTarget | null>(null);
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  // sheet open animate
  useEffect(() => {
    if (!visible) return;

    sheetHeightAnim.setValue(0);
    scrimOpacityAnim.setValue(0);
    snapRef.current = 'half';

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(sheetHeightAnim, {
          toValue: SNAP_HALF,
          damping: 26,
          stiffness: 220,
          useNativeDriver: false,
        }),
        Animated.timing(scrimOpacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [SNAP_HALF, scrimOpacityAnim, sheetHeightAnim, visible]);

  useEffect(() => {
    if (!visible) return;

    const nextChildren = initialValues?.children ?? 0;
    setOrigin('');
    setSelectedOrigin('');
    setDestinations(normalizeDestinations(initialValues?.destinations));
    setAdults(initialValues?.adults ?? 1);
    setChildren(nextChildren);
    setChildAges(normalizeAges(nextChildren, initialValues?.childAges));
    setBudget(initialValues?.budget ? String(initialValues.budget) : '');
    setActiveCalendarIndex(null);
    setPeopleExpanded(false);
    setActiveAgeDropdown(null);
    setCalendarMonth(initialValues?.destinations?.[0]?.startDate ?? new Date());
    setFocusedField(null);
    setPlacePredictions([]);
  }, [visible, initialValues]);

  useEffect(() => {
    if (!visible || !focusedField) {
      setPlacesLoading(false);
      setPlacePredictions([]);
      return;
    }

    const query = focusedField.kind === 'origin'
      ? origin.trim()
      : destinations[focusedField.index]?.destination.trim() ?? '';
    if (!GOOGLE_MAPS_API_KEY || query.length < 2) {
      setPlacesLoading(false);
      setPlacePredictions([]);
      return;
    }

    const controller = new AbortController();
    const timerId = setTimeout(async () => {
      setPlacesLoading(true);

      try {
        const params = new URLSearchParams({
          input: query,
          key: GOOGLE_MAPS_API_KEY,
          language: 'ko',
        });
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setPlacePredictions(Array.isArray(data.predictions) ? data.predictions.slice(0, 5) : []);
      } catch {
        if (!controller.signal.aborted) {
          setPlacePredictions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPlacesLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timerId);
    };
  }, [destinations, origin, focusedField, visible]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 3,
      onPanResponderGrant: () => {
        dragStartHeight.current = snapRef.current === 'half' ? SNAP_HALF : SNAP_FULL;
      },
      onPanResponderMove: (_, { dy }) => {
        const newHeight = Math.max(0, Math.min(SNAP_FULL, dragStartHeight.current - dy));
        sheetHeightAnim.setValue(newHeight);
        scrimOpacityAnim.setValue(newHeight < SNAP_HALF ? newHeight / SNAP_HALF : 1);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const releasedHeight = Math.max(0, Math.min(SNAP_FULL, dragStartHeight.current - dy));
        const midpoint = (SNAP_HALF + SNAP_FULL) / 2;

        if (vy > 0.8 || releasedHeight < SNAP_HALF * 0.4) {
          onCloseRef.current();
        } else if (releasedHeight > midpoint || vy < -0.8) {
          snapRef.current = 'full';
          scrimOpacityAnim.setValue(1);
          Animated.spring(sheetHeightAnim, {
            toValue: SNAP_FULL,
            damping: 26,
            stiffness: 220,
            useNativeDriver: false,
          }).start();
        } else {
          snapRef.current = 'half';
          scrimOpacityAnim.setValue(1);
          Animated.spring(sheetHeightAnim, {
            toValue: SNAP_HALF,
            damping: 26,
            stiffness: 220,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    const handleKeyboardShow = (event: { endCoordinates: { height: number } }) => {
      setKeyboardHeight(event.endCoordinates.height);
      snapRef.current = 'full';
      scrimOpacityAnim.setValue(1);
      Animated.spring(sheetHeightAnim, {
        toValue: SNAP_FULL,
        damping: 26,
        stiffness: 220,
        useNativeDriver: false,
      }).start();
      if (budgetFocused) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 40);
      }
    };

    const willShowSubscription = Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    const didShowSubscription = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setBudgetFocused(false);
    });

    return () => {
      willShowSubscription.remove();
      didShowSubscription.remove();
      hideSubscription.remove();
    };
  }, [SNAP_FULL, budgetFocused, scrimOpacityAnim, sheetHeightAnim]);

  useEffect(() => {
    if (!budgetFocused || keyboardHeight === 0) return;

    const scrollTimer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 30);

    return () => clearTimeout(scrollTimer);
  }, [budgetFocused, keyboardHeight]);

  const allChildAgesFilled =
    children === 0 || (childAges.length === children && childAges.every(age => age !== ''));
  const completedDestinations = destinations
    .map(value => ({
      destination: value.destination.trim(),
      selectedDestination: value.selectedDestination.trim(),
      startDate: value.startDate,
      endDate: value.endDate,
    }))
    .filter((value): value is TripDestination & { selectedDestination: string } => (
      value.destination !== '' &&
      value.selectedDestination === value.destination &&
      value.startDate !== null &&
      value.endDate !== null
    ));
  const initialDestinations = normalizeDestinations(initialValues?.destinations);
  const initialChildren = initialValues?.children ?? 0;
  const initialChildAges = normalizeAges(initialChildren, initialValues?.childAges);
  const hasChanges =
    mode === 'create' ||
    !areSameDestinations(destinations, initialDestinations) ||
    adults !== (initialValues?.adults ?? 1) ||
    children !== initialChildren ||
    !areSameAges(childAges, initialChildAges) ||
    budget !== normalizeBudget(initialValues?.budget);
  const validationMessage = (() => {
    if (mode === 'create') {
      const originTrimmed = origin.trim();
      if (originTrimmed === '') return '출발지를 입력해주세요.';
      if (selectedOrigin.trim() !== originTrimmed) return '출발지를 검색 결과에서 선택해주세요.';
    }

    const emptyDestinationIndex = destinations.findIndex(value => value.destination.trim() === '');
    if (emptyDestinationIndex >= 0) return `여행지${emptyDestinationIndex + 1}을 입력해주세요.`;

    const unselectedDestinationIndex = destinations.findIndex(value => (
      value.selectedDestination.trim() !== value.destination.trim()
    ));
    if (unselectedDestinationIndex >= 0) return `여행지${unselectedDestinationIndex + 1}을 검색 결과에서 선택해주세요.`;

    const emptyDateIndex = destinations.findIndex(value => !value.startDate || !value.endDate);
    if (emptyDateIndex >= 0) return `여행지${emptyDateIndex + 1}의 날짜를 선택해주세요.`;

    for (let index = 1; index < completedDestinations.length; index += 1) {
      const previous = completedDestinations[index - 1];
      const current = completedDestinations[index];
      const dateDiff = compareDateOnly(current.startDate, previous.endDate);

      if (dateDiff > 0) {
        return `여행지${index} 종료일과 여행지${index + 1} 시작일 사이에 빈 날짜가 있어요.`;
      }

      if (dateDiff < 0) {
        return `여행지${index}과 여행지${index + 1}의 날짜가 겹쳐요.`;
      }
    }

    if (!allChildAgesFilled) return '아동 나이를 모두 선택해주세요.';
    if (Number(budget) <= 0) return '예산을 입력해주세요.';
    if (!hasChanges) return '변경된 내용이 없습니다.';

    return '';
  })();
  const isValid = validationMessage === '';

  const peopleLabel = `성인 ${adults}명${children > 0 ? `, 아동 ${children}명` : ''}`;
  const buttonLabel = mode === 'create' ? '채팅방 생성하기' : '수정하기';
  const footerBottom = Math.max(insets.bottom, 16);
  const contentBottomPadding = budgetFocused ? keyboardHeight + footerBottom + 24 : 24;
  const minSelectableDate = useMemo(() => getTodayDateOnly(), []);

  const getDateLabel = (destination: TripDestinationDraft) => {
    if (destination.startDate && destination.endDate) {
      return `${formatDate(destination.startDate)} ~ ${formatDate(destination.endDate)}`;
    }

    if (destination.startDate) {
      return `${formatDate(destination.startDate)} ~ 종료일 선택`;
    }

    return '날짜를 선택해주세요';
  };

  const handleDayPress = (index: number, day: Date) => {
    if (compareDateOnly(day, minSelectableDate) < 0) return;

    const selectedDestination = destinations[index];
    if (!selectedDestination) return;

    if (!selectedDestination.startDate || selectedDestination.endDate) {
      setDestinations(prev => prev.map((destination, destinationIndex) => (
        destinationIndex === index
          ? { ...destination, startDate: day, endDate: null }
          : destination
      )));
      return;
    }

    if (isSameDay(day, selectedDestination.startDate)) {
      setDestinations(prev => prev.map((destination, destinationIndex) => (
        destinationIndex === index
          ? { ...destination, startDate: null, endDate: null }
          : destination
      )));
      return;
    }

    if (day < selectedDestination.startDate) {
      setDestinations(prev => prev.map((destination, destinationIndex) => (
        destinationIndex === index
          ? { ...destination, startDate: day, endDate: null }
          : destination
      )));
      return;
    }

    setDestinations(prev => prev.map((destination, destinationIndex) => (
      destinationIndex === index
        ? { ...destination, endDate: day }
        : destination
    )));
    setActiveCalendarIndex(null);
  };

  const updateChildren = (count: number) => {
    const nextChildren = Math.max(0, count);
    setChildren(nextChildren);
    setChildAges(prev => normalizeAges(nextChildren, prev.filter((age): age is AgeOption => age !== '')));
    if (nextChildren === 0) setActiveAgeDropdown(null);
  };

  const updateOrigin = (value: string) => {
    setOrigin(value);
    setSelectedOrigin('');
  };

  const updateDestination = (index: number, value: string) => {
    setDestinations(prev => prev.map((destination, destinationIndex) => (
      destinationIndex === index
        ? { ...destination, destination: value, selectedDestination: '' }
        : destination
    )));
  };

  const selectDestination = (index: number, value: string) => {
    setDestinations(prev => prev.map((destination, destinationIndex) => (
      destinationIndex === index
        ? { ...destination, destination: value, selectedDestination: value }
        : destination
    )));
  };

  const addDestination = () => {
    if (destinations.length >= MAX_DESTINATION_COUNT) return;

    setDestinations(prev => [...prev, createEmptyDestination()]);
    requestAnimationFrame(() => {
      const nextIndex = destinations.length;
      destinationInputRefs.current[nextIndex]?.focus();
    });
  };

  const removeDestination = (index: number) => {
    if (destinations.length <= 1) return;

    setDestinations(prev => prev.filter((_, destinationIndex) => destinationIndex !== index));
    setActiveCalendarIndex(current => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    setFocusedField(current => {
      if (!current || current.kind !== 'destination') return current;
      if (current.index === index) return null;
      return current.index > index ? { kind: 'destination', index: current.index - 1 } : current;
    });
    setPlacePredictions([]);
  };

  const handleSubmit = () => {
    if (!isValid) return;

    onSubmit({
      origin: selectedOrigin.trim(),
      destinations: completedDestinations.map(destination => ({
        destination: destination.destination,
        startDate: destination.startDate,
        endDate: destination.endDate,
      })),
      adults,
      children,
      childAges: childAges as AgeOption[],
      budget: Number(budget),
    });
  };

  const handleSelectPlace = (place: PlacePrediction) => {
    if (focusedField?.kind === 'origin') {
      setOrigin(place.description);
      setSelectedOrigin(place.description);
    } else if (focusedField?.kind === 'destination') {
      selectDestination(focusedField.index, place.description);
    }
    setFocusedField(null);
    setPlacePredictions([]);
    Keyboard.dismiss();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.scrim, { backgroundColor: colors.scrimModal, opacity: scrimOpacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.sheet, { backgroundColor: colors.pageBg, height: sheetHeightAnim }]}>
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.textCaption }]} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.textTitle }]}>
                {mode === 'create' ? '여행 정보를 입력해주세요' : '여행 정보 수정'}
              </Text>
              {mode === 'edit' && roomName ? (
                <Text style={[styles.roomName, { color: colors.textCaption }]} numberOfLines={1}>
                  {roomName}
                </Text>
              ) : null}
            </View>
            <View style={[styles.fieldGroup, styles.originFieldGroup]}>
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>출발지</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
                <TextInput
                  ref={originInputRef}
                  value={origin}
                  onChangeText={updateOrigin}
                  onFocus={() => setFocusedField({ kind: 'origin' })}
                  placeholder="출발지를 입력해주세요"
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.textInput, { color: colors.textTitle }]}
                />
                <Pressable
                  onPress={() => originInputRef.current?.focus()}
                  style={styles.inputIconButton}
                  hitSlop={8}
                >
                  <IcSearch
                    width={20}
                    height={20}
                    color={origin ? colors.textTitle : colors.textCaption}
                  />
                </Pressable>
              </View>
              {focusedField?.kind === 'origin' && (placesLoading || placePredictions.length > 0) ? (
                <PlaceAutocompletePanel
                  loading={placesLoading}
                  predictions={placePredictions}
                  onSelect={handleSelectPlace}
                />
              ) : null}
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.destinationList}>
                {destinations.map((destination, index) => (
                  <View key={index} style={styles.destinationItem}>
                    <View style={styles.destinationHeader}>
                      <Text style={[styles.fieldLabel, { color: colors.textSub }]}>여행지{index + 1}</Text>
                      {destinations.length > 1 ? (
                        <Pressable
                          onPress={() => removeDestination(index)}
                          style={styles.destinationDeleteButton}
                          hitSlop={8}
                        >
                          {({ pressed }) => (
                            <>
                              <IcDelete width={18} height={18} color={colors.textCaption} />
                              {pressed && (
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.full }]} />
                              )}
                            </>
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={[styles.inputBox, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
                      <TextInput
                        ref={(input) => {
                          destinationInputRefs.current[index] = input;
                        }}
                        value={destination.destination}
                        onChangeText={(value) => updateDestination(index, value)}
                        onFocus={() => setFocusedField({ kind: 'destination', index })}
                        placeholder={`여행지${index + 1}을 입력해주세요`}
                        placeholderTextColor={colors.textDisabled}
                        style={[styles.textInput, { color: colors.textTitle }]}
                      />
                      <Pressable
                        onPress={() => destinationInputRefs.current[index]?.focus()}
                        style={styles.inputIconButton}
                        hitSlop={8}
                      >
                        <IcSearch
                          width={20}
                          height={20}
                          color={destination.destination ? colors.textTitle : colors.textCaption}
                        />
                      </Pressable>
                    </View>
                    {focusedField?.kind === 'destination' && focusedField.index === index && (placesLoading || placePredictions.length > 0) ? (
                      <PlaceAutocompletePanel
                        loading={placesLoading}
                        predictions={placePredictions}
                        onSelect={handleSelectPlace}
                      />
                    ) : null}
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setFocusedField(null);
                        setPlacePredictions([]);
                        setActiveCalendarIndex(value => value === index ? null : index);
                        setCalendarMonth(destination.startDate ?? new Date());
                        setPeopleExpanded(false);
                        setActiveAgeDropdown(null);
                      }}
                      style={[styles.inputBox, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}
                    >
                      {({ pressed }) => (
                        <>
                          <Text style={[styles.inputValue, { color: destination.startDate ? colors.textTitle : colors.textDisabled }]}>
                            {getDateLabel(destination)}
                          </Text>
                          <IcPlan width={20} height={20} color={destination.startDate ? colors.textTitle : colors.textCaption} />
                          {pressed && (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.lg }]} />
                          )}
                        </>
                      )}
                    </Pressable>
                    {activeCalendarIndex === index && (
                      <Calendar
                        startDate={destination.startDate}
                        endDate={destination.endDate}
                        month={calendarMonth}
                        minSelectableDate={minSelectableDate}
                        onDayPress={(day) => handleDayPress(index, day)}
                        onPrevMonth={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                        onNextMonth={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                      />
                    )}
                  </View>
                ))}
              </View>
              {destinations.length < MAX_DESTINATION_COUNT ? (
                <Pressable
                  onPress={addDestination}
                  style={[styles.addDestinationButton, { backgroundColor: colors.primaryLight }]}
                >
                  {({ pressed }) => (
                    <>
                      <Text style={[styles.addDestinationText, { color: scheme === 'light' ? colors.cardBg : colors.textTitle }]}>
                        + 여행지 추가
                      </Text>
                      {pressed && (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.lg }]} />
                      )}
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>인원</Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setFocusedField(null);
                  setPlacePredictions([]);
                  setPeopleExpanded(value => !value);
                  setActiveCalendarIndex(null);
                  setActiveAgeDropdown(null);
                }}
                style={[styles.inputBox, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}
              >
                {({ pressed }) => (
                  <>
                    <Text style={[styles.inputValue, { color: colors.textTitle }]}>{peopleLabel}</Text>
                    <View style={peopleExpanded && styles.chevronOpen}>
                      <IcChevronDown width={20} height={20} color={peopleExpanded ? colors.textTitle : colors.textCaption} />
                    </View>
                    {pressed && (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.lg }]} />
                    )}
                  </>
                )}
              </Pressable>

              {peopleExpanded && (
                <View style={[styles.peoplePanel, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
                  <StepperRow
                    label="성인"
                    value={adults}
                    min={1}
                    onDecrement={() => setAdults(value => Math.max(1, value - 1))}
                    onIncrement={() => setAdults(value => Math.min(MAX_PEOPLE_COUNT, value + 1))}
                  />
                  <StepperRow
                    label="아동"
                    value={children}
                    onDecrement={() => updateChildren(children - 1)}
                    onIncrement={() => updateChildren(Math.min(MAX_PEOPLE_COUNT, children + 1))}
                  />
                  {childAges.map((age, index) => (
                    <View
                      key={index}
                      style={[
                        styles.ageItem,
                        activeAgeDropdown === index && styles.ageItemActive,
                      ]}
                    >
                      <View style={[styles.ageDivider, { backgroundColor: colors.divider }]} />
                      <Pressable
                        onPress={() => setActiveAgeDropdown(activeAgeDropdown === index ? null : index)}
                        style={styles.ageRow}
                      >
                        <Text style={[styles.ageLabel, { color: colors.textCaption }]}>아동 {index + 1}</Text>
                        <View style={[styles.ageValueRow, { borderColor: colors.divider }]}>
                          <Text style={[styles.ageValue, { color: age ? colors.textTitle : colors.textDisabled }]}>
                            {age || '나이 선택'}
                          </Text>
                          <View style={[styles.ageValueIcon, activeAgeDropdown === index && styles.chevronOpen]}>
                            <IcChevronDown width={12} height={12} color={age ? colors.textTitle : colors.textCaption} />
                          </View>
                        </View>
                      </Pressable>
                      {activeAgeDropdown === index && (
                        <View style={[styles.ageDropdown, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
                          {AGE_OPTIONS.map(option => (
                            <Pressable
                              key={option}
                              onPress={() => {
                                const next = [...childAges];
                                next[index] = option;
                                setChildAges(next);
                                setActiveAgeDropdown(null);
                              }}
                              style={[
                                styles.ageOption,
                                age === option && { backgroundColor: colors.primary },
                                { borderBottomColor: colors.divider },
                              ]}
                            >
                              {({ pressed }) => (
                                <>
                                  <Text style={[styles.ageOptionText, { color: age === option ? colors.pageBg : colors.textTitle }]}>
                                    {option}
                                  </Text>
                                  {pressed && (
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay }]} />
                                  )}
                                </>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.budgetGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>예산</Text>
              <View style={styles.budgetControl}>
                <Text style={[styles.budgetApprox, { color: colors.textCaption }]}>약</Text>
                <View style={[styles.budgetInputBox, { backgroundColor: colors.cardBg, borderColor: colors.divider }, Elevation[scheme][4]]}>
                  <TextInput
                    value={budget}
                    onChangeText={value => setBudget(value.replace(/[^0-9]/g, ''))}
                    onFocus={() => {
                      setBudgetFocused(true);
                      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
                    }}
                    onBlur={() => setBudgetFocused(false)}
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="number-pad"
                    style={[styles.budgetInput, { color: colors.textTitle }]}
                  />
                </View>
                <Text style={[styles.budgetUnit, { color: colors.textCaption }]}>만원</Text>
              </View>
            </View>

            <View style={[styles.footer, { paddingBottom: footerBottom }]}>
              {validationMessage ? (
                <Text style={[styles.validationText, { color: colors.danger }]}>
                  * {validationMessage}
                </Text>
              ) : null}
              <Pressable
                onPress={handleSubmit}
                disabled={!isValid}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: isValid ? colors.primary : colors.secondarySurface,
                    borderColor: isValid ? colors.primaryActive : colors.divider,
                  },
                ]}
              >
                {({ pressed }) => (
                  <>
                    <Text style={[styles.primaryButtonText, { color: isValid ? colors.pageBg : colors.textDisabled }]}>
                      {buttonLabel}
                    </Text>
                    {pressed && isValid && (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.md }]} />
                    )}
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.lgModal,
    borderTopRightRadius: BorderRadius.lgModal,
    maxWidth: 393,
    overflow: 'hidden',
    width: '96%',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  handle: {
    borderRadius: BorderRadius.full,
    height: 8,
    width: 82,
  },
  title: {
    ...Typography['heading-xl'],
    flexShrink: 0,
  },
  roomName: {
    ...Typography['body-md'],
    flex: 1,
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  fieldGroup: {
    gap: 10,
    marginBottom: 27,
  },
  originFieldGroup: {
    marginTop: 12,
  },
  budgetGroup: {
    gap: 10,
    marginBottom: 28,
  },
  fieldLabel: {
    ...Typography['heading-sm'],
  },
  destinationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  destinationDeleteButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
  destinationList: {
    gap: 10,
  },
  destinationItem: {
    gap: 8,
  },
  addDestinationButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addDestinationText: {
    ...Typography['body-md'],
    fontFamily: 'Pretendard-Bold',
  },
  inputBox: {
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 55,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 18,
  },
  textInput: {
    ...Typography['heading-sm'],
    flex: 1,
    lineHeight: undefined,
    margin: 0,
    padding: 0,
  },
  inputValue: {
    ...Typography['heading-sm'],
    flex: 1,
  },
  inputIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placePanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 2,
    overflow: 'hidden',
  },
  placeOption: {
    gap: 2,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  placeMainText: {
    ...Typography['body-md'],
  },
  placeSubText: {
    ...Typography['caption'],
  },
  placeMetaText: {
    ...Typography['body-md'],
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calendarPanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  chevronLeft: {
    transform: [{ rotate: '90deg' }],
  },
  chevronRight: {
    transform: [{ rotate: '-90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  calendarMonth: {
    ...Typography['heading-sm'],
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarDayHeader: {
    ...Typography['caption'],
    flex: 1,
    paddingVertical: 6,
    textAlign: 'center',
  },
  calendarCell: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 2,
    position: 'relative',
  },
  calendarRangeBackground: {
    bottom: 2,
    left: -1,
    position: 'absolute',
    right: -1,
    top: 2,
  },
  calendarRangeStart: {
    borderBottomLeftRadius: BorderRadius.full,
    borderTopLeftRadius: BorderRadius.full,
  },
  calendarRangeEnd: {
    borderBottomRightRadius: BorderRadius.full,
    borderTopRightRadius: BorderRadius.full,
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34,
  },
  calendarDayText: {
    ...Typography['body-md'],
  },
  peoplePanel: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'visible',
    zIndex: 10,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 62,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  stepperLabel: {
    ...Typography['heading-sm'],
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 30,
  },
  stepperButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepperIcon: {
    ...Typography['heading-md'],
    lineHeight: 22,
  },
  stepperValue: {
    ...Typography['heading-sm'],
    minWidth: 24,
    textAlign: 'center',
  },
  ageItem: {
    height: 62,
    position: 'relative',
    zIndex: 1,
  },
  ageItemActive: {
    zIndex: 20,
  },
  ageDivider: {
    height: 1,
    left: 24,
    position: 'absolute',
    right: 32,
    top: 0,
  },
  ageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 62,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  ageLabel: {
    ...Typography['heading-sm'],
    marginLeft: 8,
  },
  ageValueRow: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'flex-start',
    paddingLeft: 8,
    paddingRight: 24,
    position: 'relative',
    marginRight: 8,
    width: 92,
  },
  ageValue: {
    ...Typography['heading-sm'],
    flex: 1,
    textAlign: 'center',
  },
  ageValueIcon: {
    position: 'absolute',
    right: 8,
  },
  ageDropdown: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    bottom: 53,
    overflow: 'hidden',
    position: 'absolute',
    right: 32,
    width: 92,
    zIndex: 30,
  },
  ageOption: {
    alignItems: 'center',
    borderBottomWidth: 0.5,
    height: 23,
    justifyContent: 'center',
  },
  ageOptionText: {
    ...Typography['body-sm'],
    lineHeight: 18,
  },
  budgetControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  budgetApprox: {
    ...Typography['heading-sm'],
  },
  budgetInputBox: {
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    minWidth: 56,
    paddingHorizontal: 12,
  },
  budgetInput: {
    ...Typography['heading-sm'],
    lineHeight: undefined,
    margin: 0,
    minWidth: 32,
    padding: 0,
    textAlign: 'center',
  },
  budgetUnit: {
    ...Typography['heading-sm'],
  },
  footer: {
    alignItems: 'center',
    paddingTop: 0,
  },
  validationText: {
    ...Typography['body-sm'],
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    maxWidth: 320,
    overflow: 'hidden',
    width: '100%',
  },
  primaryButtonText: {
    ...Typography['heading-sm'],
  },
});
