/**
 * QR 코드 파싱 유틸리티
 * 의약품안전나라 QR 코드 형식 파싱
 */

export interface ParsedQRData {
  medicineName?: string;
  manufacturer?: string;
  medicineCode?: string;
  rawData: string;
}

export class QrParser {
  /**
   * QR 데이터 파싱
   * 예시 형식:
   * 품목명: 타이레놀 500mg
   * 업체명: Johnson & Johnson
   * 품목기준코드: 8806429021102
   */
  static parse(qrData: string): ParsedQRData {
    const result: ParsedQRData = {
      rawData: qrData,
    };

    // 정규식으로 필드 추출
    const nameMatch = qrData.match(/품목명[:：]\s*(.+?)(?:\n|$)/);
    const manufacturerMatch = qrData.match(/업체명[:：]\s*(.+?)(?:\n|$)/);
    const codeMatch = qrData.match(/품목기준코드[:：]\s*(.+?)(?:\n|$)/);

    if (nameMatch) {
      result.medicineName = nameMatch[1].trim();
    }

    if (manufacturerMatch) {
      result.manufacturer = manufacturerMatch[1].trim();
    }

    if (codeMatch) {
      result.medicineCode = codeMatch[1].trim();
    }

    return result;
  }

  /**
   * QR 데이터 유효성 검증
   */
  static validate(qrData: string): boolean {
    return qrData.includes('품목명') || qrData.includes('품목기준코드');
  }
}
