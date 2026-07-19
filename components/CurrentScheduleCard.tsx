import React from 'react';
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { Typography, BorderRadius, Elevation } from '@/constants/theme';
import IcNavigation from '@/assets/icons/ic_navigation.svg';
import IcClock from '@/assets/icons/ic_clock.svg';
import IcPin from '@/assets/icons/ic_pin.svg';

const ICON_TEXT_LINE_HEIGHT = 18;
const ICON_TOP_OFFSET = -1;

type Props = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  label?: string;
  imageUrl?: string | null;
};

export function CurrentScheduleCard({ title, startTime, endTime, location, label = '현재 일정', imageUrl }: Props) {
  const { colors, scheme } = useTheme();

  const surfaceColor = scheme === 'dark' ? colors.textTitle : colors.cardBg;

  const openNavigation = () => {
    const query = location.trim();
    if (!query) return;

    const encoded = encodeURIComponent(query);
    const kakaoUrl = `kakaomap://search?q=${encoded}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.canOpenURL(kakaoUrl).then(supported => {
      Linking.openURL(supported ? kakaoUrl : googleUrl);
    }).catch(() => {
      Linking.openURL(googleUrl);
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.primary }, Elevation[scheme][2]]}>
      <View style={styles.label}>
        <View style={styles.labelIconFrame}>
          <IcNavigation width={16} height={16} color={surfaceColor} />
        </View>
        <Text style={[styles.labelText, { color: surfaceColor }]}>{label}</Text>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <Text style={[styles.title, { color: surfaceColor }]}>
        {title}
      </Text>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <View style={styles.metaIconFrame}>
            <IcClock width={14} height={14} color={surfaceColor} />
          </View>
          <Text style={[styles.metaText, { color: surfaceColor }]}>
            {startTime} ~ {endTime}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaIconFrame}>
            <IcPin width={14} height={14} color={surfaceColor} />
          </View>
          <Text style={[styles.metaText, { color: surfaceColor }]}>
            {location}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={openNavigation}
        android_ripple={{ color: colors.pressOverlay, borderless: false }}
        style={[styles.button, { backgroundColor: surfaceColor }, Elevation[scheme][2]]}
      >
        {({ pressed }) => (
          <>
            <Text style={[styles.buttonText, { color: colors.primary }]}>길 안내 시작</Text>
            {pressed && (
              <View style={[StyleSheet.absoluteFill, styles.buttonOverlay, { backgroundColor: colors.pressOverlay }]} />
            )}
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: 16,
    gap: 8,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  labelIconFrame: {
    alignItems: 'center',
    height: ICON_TEXT_LINE_HEIGHT,
    justifyContent: 'center',
    marginTop: ICON_TOP_OFFSET,
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: BorderRadius.md,
  },
  labelText: {
    ...Typography['body-md'],
    includeFontPadding: false,
    lineHeight: ICON_TEXT_LINE_HEIGHT,
  },
  title: {
    ...Typography['heading-md'],
  },
  meta: {
    gap: 4,
  },
  metaRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  metaIconFrame: {
    alignItems: 'center',
    height: ICON_TEXT_LINE_HEIGHT,
    justifyContent: 'center',
    marginTop: ICON_TOP_OFFSET,
  },
  metaText: {
    ...Typography['body-md'],
    flex: 1,
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: ICON_TEXT_LINE_HEIGHT,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    ...Typography['body-lg'],
  },
  buttonOverlay: {
    borderRadius: BorderRadius.md,
  },
});
