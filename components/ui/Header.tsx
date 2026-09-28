import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Typography, Elevation } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';

export function Header() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          height: HEADER_HEIGHT + insets.top,
          paddingTop: insets.top,
          backgroundColor: colors.cardBg,
          borderBottomColor: colors.divider,
        },
        Elevation[scheme][1],
      ]}
    >
      <View style={styles.content}>
        <Image source={require('@/assets/images/img_rogo_main_cleanVersion.png')} style={styles.logo} />
        <Text style={[styles.title, { color: colors.textTitle }]}>마실</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    ...Typography['heading-lg'],
  },
});
