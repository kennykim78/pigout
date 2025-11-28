/**
 * 기기 고유 ID 관리 유틸리티
 * 
 * - 브라우저/기기별로 고유한 ID를 생성하여 localStorage에 저장
 * - 이후 이메일/휴대폰 인증을 통해 실제 사용자 계정으로 연결 가능
 */

const DEVICE_ID_KEY = 'pigout_device_id';

/**
 * UUID v4 생성
 */
function generateUUID(): string {
  // crypto.randomUUID 사용 가능하면 사용
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // 폴백: 직접 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 기기 ID 가져오기 (없으면 생성)
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('[DeviceId] 새 기기 ID 생성:', deviceId);
  }
  
  return deviceId;
}

/**
 * 기기 ID 초기화 (디버깅/테스트용)
 */
export function resetDeviceId(): string {
  const newId = generateUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  console.log('[DeviceId] 기기 ID 초기화:', newId);
  return newId;
}

/**
 * 기기 ID 존재 여부 확인
 */
export function hasDeviceId(): boolean {
  return !!localStorage.getItem(DEVICE_ID_KEY);
}

export default {
  getDeviceId,
  resetDeviceId,
  hasDeviceId,
};
