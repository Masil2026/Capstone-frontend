import React from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Elevation, Typography, BorderRadius } from '@/constants/theme';
import GoogleSignInLight from '@/assets/brand/google_sign_in_light.svg';
import GoogleSignInDark from '@/assets/brand/google_sign_in_dark.svg';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { colors, scheme } = useTheme();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleSignIn = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: '로그인 실패', text2: '다시 시도해주세요.' });
    } finally {
      setIsLoading(false);
    }
  }, [startOAuthFlow]);

  const GoogleSignInButton = scheme === 'dark' ? GoogleSignInDark : GoogleSignInLight;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('@/assets/images/img_rogo_main_cleanVersion.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.textArea}>
          <Text style={[styles.title, { color: colors.primary }]}>
            여행을 시작해볼까요?
          </Text>
          <Text style={[styles.subtitle, { color: colors.primaryTint }]}>
            로그인하고 나만의 여행을 만들어보세요
          </Text>
        </View>

        <View style={[styles.googleButtonShadow, Elevation[scheme][4]]}>
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            style={styles.googleButton}
          >
            {({ pressed }) => (
              <>
                {isLoading ? (
                  <View style={styles.loadingArea}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <GoogleSignInButton width={185} height={44} />
                )}
                {pressed && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: colors.pressOverlay, borderRadius: BorderRadius.lg },
                    ]}
                  />
                )}
              </>
            )}
          </Pressable>
        </View>

        <Text style={[styles.terms, { color: colors.textDisabled }]}>
          계속 진행하면 이용약관 및 개인정보처리방침에{'\n'}동의하는 것으로 간주됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  logoWrapper: {
    alignItems: 'center',
  },
  logo: {
    width: 185,
    height: 120,
    transform: [{ rotate: '-32deg' }],
  },
  textArea: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...Typography['heading-lg'],
    textAlign: 'center',
  },
  subtitle: {
    ...Typography['heading-sm'],
    textAlign: 'center',
  },
  googleButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  googleButtonShadow: {
    width: 185,
    height: 44,
    borderRadius: BorderRadius.full,
  },
  loadingArea: {
    width: 185,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: {
    ...Typography['label'],
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
  },
});
