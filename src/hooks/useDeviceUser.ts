import { useEffect, useState } from 'react';
import { registerDevice, getCurrentUser } from '../services/api';
import { getDeviceId, hasDeviceId } from '../utils/deviceId';

interface UserInfo {
  userId: string;
  deviceId: string;
  nickname: string;
  isVerified: boolean;
  diseases: string[];
}

/**
 * 기기 기반 사용자 관리 훅
 * 
 * - 앱 시작 시 자동으로 기기 등록 또는 조회
 * - 사용자 정보를 상태로 관리
 */
export function useDeviceUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);
        setError(null);

        // 기기 ID 확보 (없으면 자동 생성됨)
        const deviceId = getDeviceId();
        console.log('[useDeviceUser] 기기 ID:', deviceId);

        // 서버에 기기 등록 또는 조회
        const response = await registerDevice();
        
        if (response.success && response.data) {
          setUser({
            userId: response.data.userId,
            deviceId: response.data.deviceId,
            nickname: response.data.nickname,
            isVerified: response.data.isVerified,
            diseases: response.data.diseases || [],
          });
          console.log('[useDeviceUser] 사용자 초기화 완료:', response.data.userId);
        }
      } catch (err: any) {
        console.error('[useDeviceUser] 초기화 실패:', err);
        setError(err.message || '사용자 초기화 실패');
        
        // 오프라인 모드: localStorage의 기기 ID만 사용
        if (hasDeviceId()) {
          setUser({
            userId: '',
            deviceId: getDeviceId(),
            nickname: '오프라인 사용자',
            isVerified: false,
            diseases: [],
          });
        }
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  /**
   * 사용자 정보 새로고침
   */
  const refreshUser = async () => {
    try {
      const response = await getCurrentUser();
      if (response.success && response.data) {
        setUser({
          userId: response.data.userId,
          deviceId: response.data.deviceId,
          nickname: response.data.nickname,
          isVerified: response.data.isVerified,
          diseases: response.data.diseases || [],
        });
      }
    } catch (err: any) {
      console.error('[useDeviceUser] 새로고침 실패:', err);
    }
  };

  return {
    user,
    loading,
    error,
    refreshUser,
    isLoggedIn: !!user?.userId,
    deviceId: user?.deviceId || getDeviceId(),
  };
}

export default useDeviceUser;
