import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography, BorderRadius } from '@/constants/theme';
import IcPlanList from '@/assets/icons/ic_plan_list.svg';

type Tab = 'itinerary' | 'calendar';

type Props = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'itinerary', label: '여행 일정' },
  { key: 'calendar', label: '달력' },
];

export function TravelListTabBar({ tab, onTabChange }: Props) {
  const { colors, scheme } = useTheme();
  const tabTextColor = scheme === 'light' ? colors.cardBg : colors.textTitle;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.cardBg, borderBottomColor: colors.divider },
      ]}
    >
      <View style={styles.titleRow}>
        <IcPlanList width={24} height={24} color={colors.textTitle} />
        <Text style={[styles.title, { color: colors.textTitle }]}>여행목록</Text>
      </View>
      <View style={[styles.segmentBar, { backgroundColor: colors.primaryTint }]}>
        {TABS.map(({ key, label }) => {
          const isActive = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => onTabChange(key)}
              style={[styles.tab, isActive && { backgroundColor: colors.primary }]}
            >
              {({ pressed }) => (
                <>
                  <Text style={[styles.tabText, { color: tabTextColor }]}>{label}</Text>
                  {pressed && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.xs },
                      ]}
                    />
                  )}
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    gap: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...Typography['heading-xl'],
  },
  segmentBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xs,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  tabText: {
    ...Typography['body-md'],
    fontFamily: 'Pretendard-Bold',
  },
});
