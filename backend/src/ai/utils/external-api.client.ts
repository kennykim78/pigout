import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { canUseApi, recordApiUsage } from '../../utils/api-usage-monitor';
import { SupabaseService } from '../../supabase/supabase.service';

type PillIdentificationParams = {
  itemName?: string;
  itemSeq?: string;
  entpName?: string;
  color1?: string;
  color2?: string;
  shape?: string;
  drugShape?: string;
  printFront?: string;
  printBack?: string;
  pageNo?: number;
  numOfRows?: number;
};

type DrugApprovalParams = {
  itemName?: string;
  itemSeq?: string;
  entpName?: string;
  permitNo?: string;
  pageNo?: number;
  numOfRows?: number;
};

type FoodNutritionParams = {
  foodName?: string;
  dbClass?: string;
  researchYmd?: string;
  updateDate?: string;
  foodCategory1?: string;
  foodCategory2?: string;
  pageNo?: number;
  numOfRows?: number;
};

type HealthFunctionalFoodParams = {
  productName?: string;
  rawMaterialName?: string;
  companyName?: string;
  pageNo?: number;
  numOfRows?: number;
};

type DiseaseNameCodeParams = {
  keyword?: string;
  diseaseName?: string;
  medTpCd?: string;
  pageNo?: number;
  numOfRows?: number;
};

/**
 * 외부 의약품/영양 데이터 API 클라이언트
 * - 약학정보원 (KPIS)
 * - 식품의약품안전처 (MFDS)
 * - 식품영양성분 DB
 */

@Injectable()
export class ExternalApiClient {
  // 환경변수에서 키/베이스 URL 로드 (없으면 빈 문자열)
  private readonly SERVICE_KEY = process.env.MFDS_API_KEY || process.env.OPENDATA_MEDICINE_IDENTIFICATION_KEY || '';
  private readonly RECIPE_KEY = process.env.RECIPE_DB_API_KEY || '';
  private readonly HIRA_SERVICE_KEY = process.env.HIRA_API_KEY || process.env.HIRA_SERVICE_KEY || process.env.MFDS_API_KEY || '';

  // 베이스 URL 은 필요 시 환경변수로 override 가능
  private readonly MFDS_BASE_URL = process.env.MFDS_BASE_URL || 'https://apis.data.go.kr/1471000';
  private readonly RECIPE_BASE_URL = process.env.RECIPE_DB_BASE_URL || 'http://openapi.foodsafetykorea.go.kr/api';
  private readonly HIRA_BASE_URL = process.env.HIRA_BASE_URL || 'https://apis.data.go.kr/B551182';

  // SupabaseService 인스턴스 (캐싱용)
  private supabaseService: SupabaseService | null = null;

  /**
   * SupabaseService 설정 (캐싱 활성화)
   */
  setSupabaseService(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  private buildMfdsParams(params: Record<string, any>) {
    const merged = {
      serviceKey: this.SERVICE_KEY,
      _type: 'json',
      type: 'json',
      pageNo: 1,
      numOfRows: 10,
      ...params,
    };
    return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  }

  private async callMfdsApi(endpoint: string, params: Record<string, any>) {
    if (!this.SERVICE_KEY) {
      console.warn(`[MFDS] SERVICE_KEY 미설정 - ${endpoint} 호출 불가`);
      return [];
    }

    const url = `${this.MFDS_BASE_URL}/${endpoint}`;
    try {
      const response = await axios.get(url, {
        params: this.buildMfdsParams(params),
        timeout: 15000,
        headers: { Accept: 'application/json' },
      });

      const header = response.data?.header;
      if (header?.resultCode !== '00') {
        console.warn(`[MFDS] ${endpoint} resultCode=${header?.resultCode} message=${header?.resultMsg}`);
        return [];
      }

      const items = response.data?.body?.items;
      if (!items) return [];
      if (Array.isArray(items)) return items;
      if (Array.isArray(items.item)) return items.item;
      if (items.item) return [items.item];
      return Array.isArray(items?.items) ? items.items : [];
    } catch (error) {
      console.error(`[MFDS] ${endpoint} 호출 실패:`, error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  private buildHiraParams(params: Record<string, any>) {
    const merged = {
      serviceKey: this.HIRA_SERVICE_KEY || this.SERVICE_KEY,
      _type: 'json',
      pageNo: 1,
      numOfRows: 10,
      ...params,
    };
    return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  }

  private async callHiraApi(endpoint: string, params: Record<string, any>) {
    const apiKey = this.HIRA_SERVICE_KEY || this.SERVICE_KEY;
    if (!apiKey) {
      console.warn(`[HIRA] SERVICE_KEY 미설정 - ${endpoint} 호출 불가`);
      return [];
    }

    const url = `${this.HIRA_BASE_URL}/${endpoint}`;
    try {
      const response = await axios.get(url, {
        params: this.buildHiraParams(params),
        timeout: 15000,
        headers: { Accept: 'application/json' },
      });

      const header = response.data?.response?.header;
      if (header?.resultCode !== '00') {
        console.warn(`[HIRA] ${endpoint} resultCode=${header?.resultCode} message=${header?.resultMsg}`);
        return [];
      }

      const body = response.data?.response?.body;
      const items = body?.items;
      if (!items) return [];
      if (Array.isArray(items)) return items;
      if (Array.isArray(items.item)) return items.item;
      if (items.item) return [items.item];
      return [];
    } catch (error) {
      console.error(`[HIRA] ${endpoint} 호출 실패:`, error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 식약처 의약품 개요정보 조회 (e약은요) - 성공한 API
   * API 사용량 모니터링 적용 + DB 캐싱
   * @param medicineName 의약품명
   * @param numOfRows 조회할 행 수 (기본 20)
   */
  async getMedicineInfo(medicineName: string, numOfRows: number = 20): Promise<any> {
    try {
      // ================================================================
      // 0단계: DB 캐시 확인 (API 호출 없이 바로 반환)
      // ================================================================
      if (this.supabaseService) {
        const cachedResults = await this.supabaseService.getMedicineCached(medicineName);
        if (cachedResults && cachedResults.length > 0) {
          // 캐시된 데이터 유효성 검사: itemName이 비어있거나 잘못된 데이터 필터링
          const validResults = cachedResults.filter((item: any) => 
            item.itemName && item.itemName.trim() !== ''
          );
          
          if (validResults.length > 0) {
            console.log(`[0단계-캐시] ✅ DB 캐시 히트: ${medicineName} (${validResults.length}건) - API 호출 생략`);
            return validResults;
          } else {
            console.log(`[0단계-캐시] ⚠️ 캐시 데이터 무효 (itemName 비어있음): ${medicineName} - API 재조회`);
            // 무효한 캐시 삭제
            await this.supabaseService.deleteMedicineCache(medicineName);
          }
        }
      }

      // API 사용량 체크 - 한도 초과 시 AI가 대체
      if (!canUseApi('eDrugApi')) {
        console.log(`[API] 일일 한도 초과 - AI가 의약품 정보 생성`);
        const aiResults = await this.generateAIMedicineInfo(medicineName, numOfRows);
        await this.saveMedicineToCache(medicineName, aiResults, 'AI생성');
        return aiResults;
      }
      
      if (!this.SERVICE_KEY) {
        console.warn('[API] MFDS_API_KEY 미설정 - AI가 의약품 정보 생성');
        const aiResults = await this.generateAIMedicineInfo(medicineName, numOfRows);
        await this.saveMedicineToCache(medicineName, aiResults, 'AI생성');
        return aiResults;
      }
      
      // ================================================================
      // 1단계: e약은요 API 검색 (일반의약품)
      // ================================================================
      const url = `${this.MFDS_BASE_URL}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
      
      console.log(`[1단계-e약은요] 일반의약품 조회: ${medicineName}`);
      
      try {
        const response = await axios.get(url, {
          params: {
            serviceKey: this.SERVICE_KEY,
            itemName: medicineName,
            numOfRows: numOfRows,
            pageNo: 1,
            type: 'json',
          },
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.data?.header?.resultCode === '00' && response.data?.body?.items) {
          recordApiUsage('eDrugApi', 1);
          const results = response.data.body.items;
          console.log(`[1단계-e약은요] ✅ ${response.data.body.totalCount}건 검색됨 - 캐시 저장 후 반환`);
          await this.saveMedicineToCache(medicineName, results, 'e약은요');
          return results;
        }
      } catch (step1Error) {
        console.warn(`[1단계-e약은요] API 오류:`, step1Error.message);
      }

      // ================================================================
      // 2단계: 낱알정보 API 검색 (일반/전문 의약품 모두 검색 가능)
      // ================================================================
      if (!canUseApi('eDrugApi')) {
        console.log(`[2단계] API 한도 초과 - AI 대체`);
        const aiResults = await this.generateAIMedicineInfo(medicineName, numOfRows);
        await this.saveMedicineToCache(medicineName, aiResults, 'AI생성');
        return aiResults;
      }
      
      console.log(`[2단계-낱알정보] 의약품 조회 (일반/전문): ${medicineName}`);
      const pillResults = await this.searchPillIdentification(medicineName, numOfRows);
      
      if (pillResults && pillResults.length > 0) {
        console.log(`[2단계-낱알정보] ✅ ${pillResults.length}건 검색됨 - 캐시 저장 후 반환`);
        await this.saveMedicineToCache(medicineName, pillResults, '낱알정보');
        return pillResults;
      }

      // ================================================================
      // 3단계: 건강기능식품 API 검색 (키워드가 건강기능식품 관련일 때만)
      // ================================================================
      const healthFoodKeywords = ['오메가', '비타민', '프로바이오틱스', '유산균', '콜라겐', '루테인', '홍삼', '프로폴리스', '밀크씨슬', '영양제', '철분', '칼슘', '마그네슘', '아연', '셀레늄', '엽산', '코엔자임', 'CoQ10', 'EPA', 'DHA', '글루코사민', '크릴오일'];
      const isLikelyHealthFood = healthFoodKeywords.some(kw => medicineName.toLowerCase().includes(kw.toLowerCase()));
      
      if (isLikelyHealthFood) {
        if (!canUseApi('healthFoodApi')) {
          console.log(`[3단계] API 한도 초과 - AI 대체`);
          const aiResults = await this.generateAIMedicineInfo(medicineName, numOfRows);
          await this.saveMedicineToCache(medicineName, aiResults, 'AI생성');
          return aiResults;
        }
        
        console.log(`[3단계-건강기능식품] 조회 (건강기능식품 키워드 감지): ${medicineName}`);
        const healthFoodResults = await this.searchHealthFunctionalFood(medicineName, numOfRows);
        
        if (healthFoodResults && healthFoodResults.length > 0) {
          console.log(`[3단계-건강기능식품] ✅ ${healthFoodResults.length}건 검색됨 - 캐시 저장 후 반환`);
          await this.saveMedicineToCache(medicineName, healthFoodResults, '건강기능식품');
          return healthFoodResults;
        }
      } else {
        console.log(`[3단계-건강기능식품] ⏭️ 건강기능식품 키워드 미감지 - 스킵: ${medicineName}`);
      }

      // ================================================================
      // 4단계: 모든 API에서 검색 실패 - AI가 대체
      // ================================================================
      console.log(`[API 검색 실패] 모든 단계에서 결과 없음 - AI가 정보 생성: ${medicineName}`);
      const aiResults = await this.generateAIMedicineInfo(medicineName, numOfRows);
      await this.saveMedicineToCache(medicineName, aiResults, 'AI생성');
      return aiResults;
      
    } catch (error) {
      console.error('[getMedicineInfo] 오류 발생 - AI 대체:', error.message);
      return this.generateAIMedicineInfo(medicineName, numOfRows);
    }
  }

  /**
   * 의약품 검색 결과 캐시 저장 헬퍼
   */
  private async saveMedicineToCache(keyword: string, results: any[], source: string): Promise<void> {
    if (this.supabaseService && results && results.length > 0) {
      await this.supabaseService.saveMedicineCache(keyword, results, source);
    }
  }

  /**
   * AI가 의약품/건강기능식품 정보 생성 (API 한도 초과 또는 검색 실패 시)
   * @param productName 제품명
   * @param numOfRows 생성할 결과 수
   */
  private async generateAIMedicineInfo(productName: string, numOfRows: number = 5): Promise<any[]> {
    try {
      console.log(`[AI 대체] ${productName} 정보 생성 중...`);
      
      // Gemini AI로 의약품/건강기능식품 정보 생성
      const geminiClient = await this.getGeminiClientForFallback();
      if (geminiClient) {
        const aiResults = await geminiClient.generateMedicineInfo(productName, numOfRows);
        if (aiResults && aiResults.length > 0) {
          console.log(`[AI 대체] ✅ ${aiResults.length}건 생성 완료`);
          return aiResults;
        }
      }
      
      // AI도 실패하면 기본 정보 반환
      console.log(`[AI 대체] AI 생성 실패 - 기본 정보 반환`);
      return [{
        itemName: productName,
        entpName: '정보 없음',
        itemSeq: `AI_${Date.now()}`,
        efcyQesitm: `${productName}의 효능 정보를 확인할 수 없습니다. 의사/약사와 상담하세요.`,
        useMethodQesitm: '용법용량은 제품 라벨 또는 의사/약사의 지시에 따르세요.',
        atpnWarnQesitm: '',
        atpnQesitm: '복용 전 의사/약사와 상담하세요.',
        intrcQesitm: '다른 약물과의 상호작용은 전문가와 상담하세요.',
        seQesitm: '이상반응 발생 시 복용을 중단하고 전문가와 상담하세요.',
        depositMethodQesitm: '서늘하고 건조한 곳에 보관하세요.',
        itemImage: '',
        _isAIGenerated: true,
        _source: 'AI 생성',
      }];
    } catch (error) {
      console.error('[AI 대체] 오류:', error.message);
      return [];
    }
  }

  /**
   * AI 대체용 Gemini 클라이언트 가져오기
   */
  private async getGeminiClientForFallback(): Promise<any> {
    try {
      // GeminiClient가 이미 있으면 사용
      if (this.geminiClient) {
        return this.geminiClient;
      }
      return null;
    } catch {
      return null;
    }
  }

  private geminiClient: any = null;
  
  setGeminiClient(client: any) {
    this.geminiClient = client;
  }

  /**
   * 전문의약품 검색 (의약품 허가정보 API)
   * e약은요에서 검색되지 않는 전문의약품(콜킨, 콜키신 등)을 검색
   * @param medicineName 의약품명
   * @param numOfRows 조회할 행 수
   */
  async searchPrescriptionDrug(medicineName: string, numOfRows: number = 20): Promise<any[]> {
    try {
      // 최신 API 버전 사용: DrugPrdtPrmsnInfoService07 (2025년 기준)
      const url = `${this.MFDS_BASE_URL}/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07`;
      
      console.log(`[의약품허가정보] 전문의약품 조회: ${medicineName}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          item_name: medicineName,
          numOfRows: numOfRows,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      const body = response.data?.body;
      if (body?.items) {
        const items = Array.isArray(body.items) ? body.items : 
                      (body.items.item ? (Array.isArray(body.items.item) ? body.items.item : [body.items.item]) : []);
        
        if (items.length > 0) {
          recordApiUsage('eDrugApi', 1);
          // 전문의약품 데이터를 e약은요 형식으로 변환
          return items.map((item: any) => this.convertApprovalToEasyDrugFormat(item));
        }
      }
      
      return [];
    } catch (error) {
      console.error('[의약품허가정보] API error:', error.message);
      return [];
    }
  }

  /**
   * 의약품 허가정보 데이터를 e약은요 형식으로 변환
   * Result2에서 동일한 형식으로 처리할 수 있도록 함
   */
  private convertApprovalToEasyDrugFormat(approvalItem: any): any {
    return {
      itemName: approvalItem.ITEM_NAME || approvalItem.item_name || '',
      entpName: approvalItem.ENTP_NAME || approvalItem.entp_name || '',
      itemSeq: approvalItem.ITEM_SEQ || approvalItem.item_seq || '',
      efcyQesitm: approvalItem.EE_DOC_DATA || approvalItem.EE_DOC_ID || '효능효과 정보는 의사/약사와 상담하세요.',
      useMethodQesitm: approvalItem.UD_DOC_DATA || approvalItem.UD_DOC_ID || '용법용량 정보는 의사/약사와 상담하세요.',
      atpnWarnQesitm: approvalItem.NB_DOC_DATA || '',
      atpnQesitm: approvalItem.NB_DOC_DATA || '주의사항 정보는 의사/약사와 상담하세요.',
      intrcQesitm: '상호작용 정보는 의사/약사와 상담하세요.',
      seQesitm: '부작용 정보는 의사/약사와 상담하세요.',
      depositMethodQesitm: approvalItem.STORAGE_METHOD || '보관방법 정보는 의사/약사와 상담하세요.',
      itemImage: approvalItem.BIG_PRDT_IMG_URL || approvalItem.itemImage || '',
      // 전문의약품 표시
      _isPrescriptionDrug: true,
      _source: '의약품허가정보API',
      // 원본 데이터 보존
      _originalData: approvalItem,
    };
  }

  /**
   * 낱알정보 API로 의약품 검색 (MdcinGrnIdntfcInfoService03)
   * 일반/전문 의약품 모두 검색 가능 - 전문의약품 검색에 더 적합
   * @param medicineName 의약품명
   * @param numOfRows 조회할 행 수
   */
  async searchPillIdentification(medicineName: string, numOfRows: number = 20): Promise<any[]> {
    try {
      const url = `${this.MFDS_BASE_URL}/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03`;
      
      console.log(`[낱알정보] 의약품 조회 (일반/전문): ${medicineName}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          item_name: medicineName,
          numOfRows: numOfRows,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      const body = response.data?.body;
      if (body?.items) {
        const items = Array.isArray(body.items) ? body.items : 
                      (body.items.item ? (Array.isArray(body.items.item) ? body.items.item : [body.items.item]) : []);
        
        if (items.length > 0) {
          recordApiUsage('eDrugApi', 1);
          console.log(`[낱알정보] ✅ ${items.length}건 검색 (전체: ${body.totalCount}건)`);
          // 낱알정보 데이터를 e약은요 형식으로 변환
          return items.map((item: any) => this.convertPillToEasyDrugFormat(item));
        }
      }
      
      console.log(`[낱알정보] 검색 결과 없음: ${medicineName}`);
      return [];
    } catch (error) {
      console.error('[낱알정보] API error:', error.message);
      return [];
    }
  }

  /**
   * 낱알정보 데이터를 e약은요 형식으로 변환
   * 낱알정보 API는 전문의약품도 포함하므로 상세 정보 제공
   */
  private convertPillToEasyDrugFormat(pillItem: any): any {
    // 분류명으로 전문/일반 구분
    const classNo = pillItem.CLASS_NO || '';
    const className = pillItem.CLASS_NAME || '';
    const isPrescriptionDrug = className.includes('전문의약품') || 
                               classNo.startsWith('1') || // 전문의약품 분류 코드
                               !className.includes('일반의약품');
    
    return {
      itemName: pillItem.ITEM_NAME || '',
      entpName: pillItem.ENTP_NAME || '',
      itemSeq: pillItem.ITEM_SEQ || '',
      efcyQesitm: pillItem.CLASS_NAME ? 
        `[${pillItem.CLASS_NAME}] ${isPrescriptionDrug ? '전문의약품입니다. 의사의 처방이 필요합니다.' : '일반의약품입니다.'}` : 
        '효능효과 정보는 의사/약사와 상담하세요.',
      useMethodQesitm: '용법용량 정보는 처방전 또는 제품 라벨을 확인하세요.',
      atpnWarnQesitm: '',
      atpnQesitm: isPrescriptionDrug ? 
        '전문의약품입니다. 반드시 의사의 지시에 따라 복용하세요.' : 
        '주의사항은 제품 라벨을 확인하세요.',
      intrcQesitm: '상호작용 정보는 의사/약사와 상담하세요.',
      seQesitm: '부작용 정보는 의사/약사와 상담하세요.',
      depositMethodQesitm: '보관방법은 제품 라벨을 확인하세요.',
      itemImage: pillItem.ITEM_IMAGE || '',
      // 의약품 분류 정보
      _isPrescriptionDrug: isPrescriptionDrug,
      _isGeneralDrug: !isPrescriptionDrug,
      _source: '낱알정보API',
      _classNo: classNo,
      _className: className,
      // 낱알식별 정보 (모양, 색상 등)
      _drugShape: pillItem.DRUG_SHAPE || '',
      _colorClass1: pillItem.COLOR_CLASS1 || '',
      _colorClass2: pillItem.COLOR_CLASS2 || '',
      _printFront: pillItem.PRINT_FRONT || '',
      _printBack: pillItem.PRINT_BACK || '',
      // 원본 데이터 보존
      _originalData: pillItem,
    };
  }

  /**
   * 건강기능식품 검색 (HtfsInfoService03 API)
   * 의약품에서 검색되지 않는 건강기능식품(오메가3, 비타민 등)을 검색
   * @param productName 제품명
   * @param numOfRows 조회할 행 수
   */
  async searchHealthFunctionalFood(productName: string, numOfRows: number = 20): Promise<any[]> {
    try {
      const url = `${this.MFDS_BASE_URL}/HtfsInfoService03/getHtfsList01`;
      
      console.log(`[건강기능식품] 조회: ${productName}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          prdlst_nm: productName,
          numOfRows: numOfRows,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      const body = response.data?.body;
      if (body?.items) {
        const items = Array.isArray(body.items) ? body.items : 
                      (body.items.item ? (Array.isArray(body.items.item) ? body.items.item : [body.items.item]) : []);
        
        if (items.length > 0) {
          recordApiUsage('healthFoodApi', 1);
          // 건강기능식품 데이터를 e약은요 형식으로 변환
          return items.map((item: any) => this.convertHealthFoodToEasyDrugFormat(item));
        }
      }
      
      return [];
    } catch (error) {
      console.error('[건강기능식품] API error:', error.message);
      return [];
    }
  }

  /**
   * 건강기능식품 데이터를 e약은요 형식으로 변환
   * 기존 의약품 로직과 호환되도록 변환
   */
  private convertHealthFoodToEasyDrugFormat(healthFoodItem: any): any {
    // 기능성 내용 파싱
    const functionality = healthFoodItem.PRIMARY_FNCLTY || healthFoodItem.FNCLTY_CN || '';
    // 섭취 방법 파싱  
    const intakeMethod = healthFoodItem.INTAKE_HINT1 || healthFoodItem.NTK_MTHD || '';
    // 주의사항 파싱
    const caution = healthFoodItem.CSTDY_MTHD || healthFoodItem.IFTKN_ATNT_MATR_CN || '';
    
    return {
      itemName: healthFoodItem.PRDLST_NM || healthFoodItem.prdlst_nm || '',
      entpName: healthFoodItem.ENTRPS || healthFoodItem.BSSH_NM || healthFoodItem.entrps || '',
      itemSeq: healthFoodItem.PRDLST_REPORT_NO || healthFoodItem.prdlst_report_no || `HF_${Date.now()}`,
      efcyQesitm: functionality || '건강기능식품입니다. 기능성 정보는 제품 라벨을 확인하세요.',
      useMethodQesitm: intakeMethod || '섭취 방법은 제품 라벨을 확인하세요.',
      atpnWarnQesitm: caution || '',
      atpnQesitm: caution || '주의사항은 제품 라벨을 확인하세요.',
      intrcQesitm: '의약품과 함께 복용 시 전문가와 상담하세요.',
      seQesitm: '이상반응 발생 시 섭취를 중단하고 전문가와 상담하세요.',
      depositMethodQesitm: healthFoodItem.CSTDY_MTHD || '서늘하고 건조한 곳에 보관하세요.',
      itemImage: '',
      // 건강기능식품 표시
      _isHealthFunctionalFood: true,
      _source: '건강기능식품정보API',
      // 추가 정보
      _rawMaterial: healthFoodItem.RAWMTRL_NM || healthFoodItem.rawmtrl_nm || '',
      _shelfLife: healthFoodItem.POG_DAYCNT || '',
      // 원본 데이터 보존
      _originalData: healthFoodItem,
    };
  }

  /**
   * 효능(질병)으로 약품 검색
   * @param efficacy 효능/질병 키워드 (예: "두통", "감기", "혈압")
   * @param numOfRows 검색 결과 수
   */
  async searchMedicineByEfficacy(efficacy: string, numOfRows: number = 20): Promise<any> {
    try {
      if (!this.SERVICE_KEY) {
        console.warn('[e약은요] MFDS_API_KEY 미설정 - Mock 데이터 사용');
        return [];
      }
      const url = `${this.MFDS_BASE_URL}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
      
      console.log(`[e약은요] 효능 검색: ${efficacy}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          efcyQesitm: efficacy,
          numOfRows: numOfRows,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data?.header?.resultCode === '00' && response.data?.body?.items) {
        console.log(`[e약은요-효능] ${response.data.body.totalCount}건 검색됨`);
        return response.data.body.items;
      }

      console.log(`[e약은요-효능] 검색 결과 없음`);
      return [];
    } catch (error) {
      console.error('[e약은요-효능] API error:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 제조사로 약품 검색
   * @param manufacturer 제조사명 (예: "한국유나이티드제약", "일동제약")
   * @param numOfRows 검색 결과 수
   */
  async searchMedicineByManufacturer(manufacturer: string, numOfRows: number = 20): Promise<any> {
    try {
      if (!this.SERVICE_KEY) {
        console.warn('[e약은요] MFDS_API_KEY 미설정 - Mock 데이터 사용');
        return [];
      }
      const url = `${this.MFDS_BASE_URL}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
      
      console.log(`[e약은요] 제조사 검색: ${manufacturer}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          entpName: manufacturer,
          numOfRows: numOfRows,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data?.header?.resultCode === '00' && response.data?.body?.items) {
        console.log(`[e약은요-제조사] ${response.data.body.totalCount}건 검색됨`);
        return response.data.body.items;
      }

      console.log(`[e약은요-제조사] 검색 결과 없음`);
      return [];
    } catch (error) {
      console.error('[e약은요-제조사] API error:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 약물-음식 상호작용 분석
   * e약은요 API의 주의사항(atpnQesitm), 상호작용(intrcQesitm) 정보 활용
   * @param medicineName 약물명
   * @param foodName 음식명 (옵션)
   */
  async analyzeMedicineFoodInteraction(medicineName: string, foodName?: string): Promise<any> {
    try {
      // 1. e약은요 API로 약물 정보 조회 (최대 3개 결과)
      const medicineInfo = await this.getMedicineInfo(medicineName, 3);
      
      if (!medicineInfo || medicineInfo.length === 0) {
        console.log(`[상호작용] ${medicineName} 정보 없음`);
        return {
          medicine: medicineName,
          food: foodName || '정보 없음',
          hasInteraction: false,
          riskLevel: 'insufficient_data',
          precautions: [],
          interactions: [],
          description: '약물 정보를 찾을 수 없습니다.',
        };
      }

      const medicine = medicineInfo[0]; // 첫 번째 결과 사용
      
      // 2. 주의사항 및 상호작용 정보 추출
      const precautions = medicine.atpnQesitm || '';
      const warnings = medicine.atpnWarnQesitm || '';
      const interactions = medicine.intrcQesitm || '';
      const sideEffects = medicine.seQesitm || '';
      const efficacy = medicine.efcyQesitm || '';
      const usage = medicine.useMethodQesitm || '';
      
      // 3. 확장된 음식 관련 키워드 검색 (더 구체적)
      const foodKeywordPatterns = {
        alcohol: ['음주', '알코올', '술', '주류', '에탄올'],
        timing: ['공복', '식후', '식전', '식사', '복용시간'],
        dairy: ['우유', '유제품', '치즈', '요구르트', '칼슘'],
        caffeine: ['커피', '카페인', '차', '홍차', '녹차', '에너지음료'],
        citrus: ['자몽', '오렌지', '귤', '감귤', '레몬'],
        vegetables: ['채소', '시금치', '양배추', '케일', '브로콜리', '비타민K'],
        highSodium: ['소금', '나트륨', '짠', '염분'],
        highPotassium: ['칼륨', '바나나', '감자', '토마토'],
        highFat: ['지방', '기름진', '튀김', '고지방'],
        other: ['음식', '식품', '섭취'],
      };
      
      const detectedPatterns: Record<string, string[]> = {};
      const allText = `${precautions} ${warnings} ${interactions} ${usage}`.toLowerCase();
      
      for (const [category, keywords] of Object.entries(foodKeywordPatterns) as [string, string[]][]) {
        const matched = keywords.filter(keyword => allText.includes(keyword));
        if (matched.length > 0) {
          detectedPatterns[category] = matched;
        }
      }
      
      // 4. 특정 음식과의 상호작용 확인 (음식명이 제공된 경우)
      let specificFoodInteraction = null;
      if (foodName) {
        const foodLower = foodName.toLowerCase();
        specificFoodInteraction = {
          hasMatch: false,
          matchedKeywords: [],
          risk: 'unknown',
        };
        
        // 음식명과 패턴 매칭
        for (const [category, keywords] of Object.entries(detectedPatterns)) {
          for (const keyword of keywords) {
            if (foodLower.includes(keyword) || allText.includes(foodLower)) {
              specificFoodInteraction.hasMatch = true;
              specificFoodInteraction.matchedKeywords.push({ category, keyword });
            }
          }
        }
      }
      
      // 5. 위험도 평가 개선
      let riskLevel = 'safe';
      const criticalWarnings = ['금기', '즉시', '중단', '위험', '심각', '응급', '반드시'];
      const cautionWarnings = ['주의', '피하', '조심', '제한', '삼가'];
      
      if (criticalWarnings.some(w => warnings.includes(w) || precautions.includes(w))) {
        riskLevel = 'danger';
      } else if (cautionWarnings.some(w => warnings.includes(w) || precautions.includes(w))) {
        riskLevel = 'caution';
      } else if (Object.keys(detectedPatterns).length > 0) {
        riskLevel = 'caution';
      }
      
      console.log(`[상호작용] ${medicineName} - 패턴: ${Object.keys(detectedPatterns).join(', ')}, 위험도: ${riskLevel}`);
      
      return {
        medicine: medicine.itemName,
        manufacturer: medicine.entpName,
        itemSeq: medicine.itemSeq,
        food: foodName || '일반 음식',
        hasInteraction: Object.keys(detectedPatterns).length > 0,
        riskLevel,
        detectedPatterns, // 카테고리별 매칭 키워드
        specificFoodInteraction, // 특정 음식과의 상호작용
        precautions: precautions.split('\n').filter(p => p.trim()),
        warnings: warnings.split('\n').filter(w => w.trim()),
        interactions: interactions.split('\n').filter(i => i.trim()),
        sideEffects: sideEffects.split('\n').filter(s => s.trim()).slice(0, 5),
        efficacy: efficacy,
        usage: usage,
        citation: ['식품의약품안전처 의약품개요정보(e약은요)'],
        // 추가 분석 정보
        analysisDetails: {
          totalTextLength: allText.length,
          hasWarnings: warnings.length > 0,
          hasPrecautions: precautions.length > 0,
          hasInteractions: interactions.length > 0,
        },
      };
    } catch (error) {
      console.error('[상호작용] 분석 오류:', error.message);
      return {
        medicine: medicineName,
        food: foodName || '정보 없음',
        hasInteraction: false,
        riskLevel: 'error',
        description: '상호작용 분석 중 오류가 발생했습니다.',
        error: error.message,
      };
    }
  }

  /**
   * 조리식품 레시피 정보 조회 (COOKRCP01) - 성공한 API
   * 영양성분 정보(칼로리, 나트륨, 탄수화물, 단백질, 지방) 포함
   * API 사용량 모니터링 적용
   * @param foodName 음식명
   */
  async getRecipeInfo(foodName: string): Promise<any> {
    try {
      // API 사용량 체크 - 한도 초과 시 빈 배열 반환 (AI가 대체)
      if (!canUseApi('recipeApi')) {
        console.log(`[레시피DB] 일일 한도 초과 - AI 분석으로 대체`);
        return [];
      }
      
      if (!this.RECIPE_KEY) {
        console.warn('[레시피DB] RECIPE_DB_API_KEY 미설정 - 빈 결과 반환');
        return [];
      }
      const url = `${this.RECIPE_BASE_URL}/${this.RECIPE_KEY}/COOKRCP01/json/1/10`;
      
      console.log(`[레시피DB] 조회: ${foodName}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data?.COOKRCP01?.RESULT?.CODE === 'INFO-000') {
        // API 호출 성공 시 사용량 기록
        recordApiUsage('recipeApi', 1);
        
        const allRecipes = response.data.COOKRCP01.row || [];
        
        // 음식명으로 필터링
        const filteredRecipes = allRecipes.filter(recipe => 
          recipe.RCP_NM?.includes(foodName) || 
          recipe.HASH_TAG?.includes(foodName)
        );
        
        console.log(`[레시피DB] 전체 ${allRecipes.length}건 중 ${filteredRecipes.length}건 매칭`);
        
        if (filteredRecipes.length > 0) {
          return filteredRecipes;
        }
        
        // 매칭 실패 시 전체 결과 반환 (일부)
        return allRecipes.slice(0, 3);
      }

      console.log(`[레시피DB] 검색 결과 없음`);
      return [];
    } catch (error) {
      console.error('[레시피DB] API error:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 키 미설정 시 사용하는 간단 Mock 약품 데이터
   */
  private generateMockMedicines(keyword: string) {
    const base = [
      {
        itemSeq: '0001',
        itemName: '타이레놀 500mg',
        entpName: '존슨앤드존슨',
        efcyQesitm: '두통, 발열, 근육통 완화',
        useMethodQesitm: '성인 1회 1정, 1일 최대 3회',
        atpnWarnQesitm: '과다 복용 시 간 손상 위험',
        atpnQesitm: '공복 복용 가능하나 식후 권장',
        intrcQesitm: '다른 해열진통제와 병용 주의',
        seQesitm: '드물게 피부 발진, 간기능 이상',
        depositMethodQesitm: '실온 보관',
      },
      {
        itemSeq: '0002',
         itemName: '아스피린 100mg',
        entpName: '바이엘',
        efcyQesitm: '혈전 예방, 심혈관 질환 위험 감소',
        useMethodQesitm: '성인 1일 1회 1정',
        atpnWarnQesitm: '위궤양 환자 복용 주의',
        atpnQesitm: '공복 복용 시 위장 장애 가능, 식후 복용 권장',
        intrcQesitm: '항응고제와 병용 시 출혈 위험 증가',
        seQesitm: '속쓰림, 위장 출혈 가능성',
        depositMethodQesitm: '건냉한 곳 보관',
      },
      {
        itemSeq: '0003',
        itemName: '판콜A',
        entpName: '동아제약',
        efcyQesitm: '감기 증상(콧물, 재채기, 두통) 완화',
        useMethodQesitm: '성인 1회 1포, 1일 3회 식후',
        atpnWarnQesitm: '수면제와 병용 주의',
        atpnQesitm: '졸음 유발 가능 운전 주의',
        intrcQesitm: '다른 감기약과 병용 시 성분 중복 가능',
        seQesitm: '졸림, 어지러움',
        depositMethodQesitm: '습기 피하고 실온 보관',
      },
    ];
    return base.filter(m => m.itemName.includes(keyword) || keyword === '*');
  }

  /**
   * 레시피 정보에서 영양 데이터 추출
   */
  extractNutritionFromRecipe(recipe: any): any {
    if (!recipe) return null;
    
    return {
      foodName: recipe.RCP_NM || '정보 없음',
      calories: parseInt(recipe.INFO_ENG) || 0,
      sodium: parseInt(recipe.INFO_NA) || 0,
      carbohydrates: parseInt(recipe.INFO_CAR) || 0,
      protein: parseInt(recipe.INFO_PRO) || 0,
      fat: parseInt(recipe.INFO_FAT) || 0,
      category: recipe.RCP_PAT2 || '기타',
      cookingMethod: recipe.RCP_WAY2 || '정보 없음',
      ingredients: recipe.RCP_PARTS_DTLS || '정보 없음',
      hashtags: recipe.HASH_TAG || '',
      lowSodiumTip: recipe.RCP_NA_TIP || '',
      citation: ['식품안전나라 조리식품 레시피DB'],
    };
  }

  /**
   * 질병별 식이 가이드라인 조회 (Mock)
   * 실제로는 대한영양학회, 질병관리청 등의 API 또는 RAG DB 연동 필요
   */
  async getDiseaseGuideline(disease: string): Promise<any> {
    const guidelines = {
      '고혈압': {
        disease: '고혈압',
        recommendations: [
          '나트륨 섭취를 하루 2,000mg 이하로 제한',
          '칼륨이 풍부한 채소, 과일 섭취 권장',
          '포화지방 및 트랜스지방 섭취 제한',
        ],
        avoid: ['고염분 음식', '가공식품', '인스턴트 식품'],
        citation: ['대한고혈압학회 진료지침 (2023)', '질병관리청 고혈압 관리지침'],
      },
      '당뇨': {
        disease: '당뇨',
        recommendations: [
          '단순당 섭취 제한',
          '복합 탄수화물 위주 식단',
          '식이섬유 섭취 증가',
          '규칙적인 식사 시간 유지',
        ],
        avoid: ['고당분 음식', '정제 탄수화물', '고지방 식품'],
        citation: ['대한당뇨병학회 진료지침 (2023)', '식품의약품안전처 당뇨 관리 가이드'],
      },
      '고지혈증': {
        disease: '고지혈증',
        recommendations: [
          '불포화지방산 섭취 증가 (오메가-3)',
          '식이섬유 섭취 증가',
          '콜레스테롤 섭취 제한',
        ],
        avoid: ['고콜레스테롤 음식', '포화지방', '트랜스지방'],
        citation: ['대한심장학회 이상지질혈증 가이드라인'],
      },
    };

    return guidelines[disease] || {
      disease,
      recommendations: [],
      avoid: [],
      citation: ['근거 데이터 없음'],
    };
  }

  // ==================== Mock 데이터 ====================

  private getMockMedicineInfo(medicineName: string): any {
    return [
      {
        itemName: medicineName,
        ingredients: ['성분 정보 미제공'],
        drugClass: '분류 정보 미제공',
        manufacturer: '제조사 정보 미제공',
        efficacy: 'API 연동 필요',
        usage: 'API 연동 필요',
        precautions: 'MFDS_API_KEY 환경변수 설정 필요',
        citation: ['Mock Data - API Key 필요'],
      },
    ];
  }

  private getMockDrugInteraction(drug1: string, drug2?: string): any {
    return [
      {
        drug1,
        drug2: drug2 || '정보 없음',
        interactionLevel: 'insufficient_data',
        description: 'API 연동이 필요합니다. MFDS_API_KEY를 설정해주세요.',
        mechanism: '데이터 없음',
        citation: ['Mock Data - API Key 필요'],
      },
    ];
  }

  private getMockNutritionInfo(foodName: string): any {
    // 일반적인 한국 음식 영양 정보 예시
    const commonFoods = {
      '김치찌개': {
        foodName: '김치찌개',
        calories: 150,
        sodium: 1200,
        protein: 15,
        fat: 8,
        carbohydrates: 10,
        citation: ['Mock Data - NUTRITION_API_KEY 필요'],
      },
      '된장찌개': {
        foodName: '된장찌개',
        calories: 120,
        sodium: 1000,
        protein: 12,
        fat: 6,
        carbohydrates: 8,
        citation: ['Mock Data - NUTRITION_API_KEY 필요'],
      },
      '삼겹살': {
        foodName: '삼겹살',
        calories: 350,
        sodium: 300,
        protein: 25,
        fat: 30,
        carbohydrates: 0,
        citation: ['Mock Data - NUTRITION_API_KEY 필요'],
      },
    };

    return commonFoods[foodName] || {
      foodName,
      calories: 0,
      sodium: 0,
      protein: 0,
      fat: 0,
      carbohydrates: 0,
      citation: ['Mock Data - 해당 음식 정보 없음'],
    };
  }

  /**
   * 의약품 낱알식별 정보 조회
   */
  async getPillIdentificationInfo(params: PillIdentificationParams = {}): Promise<any[]> {
    return this.callMfdsApi('MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03', {
      item_name: params.itemName,
      item_seq: params.itemSeq,
      entp_name: params.entpName,
      color_class1: params.color1,
      color_class2: params.color2,
      drug_shape: params.drugShape || params.shape,
      print_front: params.printFront,
      print_back: params.printBack,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
    });
  }

  /**
   * 의약품 제품허가정보 조회
   */
  async getDrugApprovalInfo(params: DrugApprovalParams = {}): Promise<any[]> {
    // 의약품 제품 허가 목록 조회 (최신 버전)
    return this.callMfdsApi('DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07', {
      item_name: params.itemName,
      item_seq: params.itemSeq,
      entp_name: params.entpName,
      prduct_prmisn_no: params.permitNo,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
    });
  }

  /**
   * 식품영양성분DB 조회
   * API 사용량 모니터링 적용
   */
  async getFoodNutritionPublicData(params: FoodNutritionParams = {}): Promise<any[]> {
    // API 사용량 체크
    if (!canUseApi('nutritionApi')) {
      console.log(`[식품영양성분] 일일 한도 초과 - AI 분석으로 대체`);
      return [];
    }
    
    const result = await this.callMfdsApi('FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02', {
      FOOD_NM_KR: params.foodName,
      DB_CLASS_NM: params.dbClass,
      RESEARCH_YMD: params.researchYmd,
      UPDATE_DATE: params.updateDate,
      FOOD_CAT1_NM: params.foodCategory1,
      FOOD_CAT2_NM: params.foodCategory2,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
    });
    
    if (result && result.length > 0) {
      recordApiUsage('nutritionApi', 1);
    }
    return result;
  }

  /**
   * 건강기능식품 목록 조회
   * API 사용량 모니터링 적용
   */
  async getHealthFunctionalFoodList(params: HealthFunctionalFoodParams = {}): Promise<any[]> {
    // API 사용량 체크
    if (!canUseApi('healthFoodApi')) {
      console.log(`[건강기능식품] 일일 한도 초과 - AI 분석으로 대체`);
      return [];
    }
    
    const result = await this.callMfdsApi('HtfsInfoService03/getHtfsList01', {
      prdlst_nm: params.productName,
      rawmtrl_nm: params.rawMaterialName,
      entrps: params.companyName,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
    });
    
    if (result && result.length > 0) {
      recordApiUsage('healthFoodApi', 1);
    }
    return result;
  }

  /**
   * 건강보험심사평가원 질병정보 조회
   */
  async getDiseaseNameCodeList(params: DiseaseNameCodeParams = {}): Promise<any[]> {
    return this.callHiraApi('diseaseInfoService1/getDissNameCodeList1', {
      sickNm: params.keyword || params.diseaseName,
      medTpCd: params.medTpCd,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
    });
  }
}
