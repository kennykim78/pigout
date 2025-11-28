import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { canUseApi, recordApiUsage } from '../../utils/api-usage-monitor';

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
   * API 사용량 모니터링 적용
   * @param medicineName 의약품명
   * @param numOfRows 조회할 행 수 (기본 20)
   */
  async getMedicineInfo(medicineName: string, numOfRows: number = 20): Promise<any> {
    try {
      // API 사용량 체크 - 한도 초과 시 빈 배열 반환 (AI가 대체)
      if (!canUseApi('eDrugApi')) {
        console.log(`[e약은요] 일일 한도 초과 - AI 분석으로 대체`);
        return [];
      }
      
      if (!this.SERVICE_KEY) {
        console.warn('[e약은요] MFDS_API_KEY 미설정 - Mock 데이터 사용');
        return this.generateMockMedicines(medicineName);
      }
      const url = `${this.MFDS_BASE_URL}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
      
      console.log(`[e약은요] 의약품 조회: ${medicineName}`);
      
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
        // API 호출 성공 시 사용량 기록
        recordApiUsage('eDrugApi', 1);
        console.log(`[e약은요] ${response.data.body.totalCount}건 검색됨`);
        return response.data.body.items;
      }

      console.log(`[e약은요] 검색 결과 없음`);
      return [];
    } catch (error) {
      console.error('[e약은요] API error:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
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
