import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';
import { BottomNavigation } from '@/components/ui/BottomNavigation';
import { useApi } from '@/hooks/useApi';
import { registerUser } from '@/api/auth';

// 모듈 레벨 — 컴포넌트 re-mount(Strict Mode 포함)와 무관하게 유지됨
let hasRegistered = false;

export default function MainLayout() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { authRequest } = useApi();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      hasRegistered = false; // 로그아웃 후 재로그인 시 재등록 허용
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || hasRegistered) return;

    hasRegistered = true;
    authRequest(registerUser).catch((e) => {
      console.error('유저 등록 실패:', e); // 이미 존재하는 유저면 백엔드에서 무시 (idempotent)
    });
  }, [authRequest, isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomNavigation />
    </>
  );
}
