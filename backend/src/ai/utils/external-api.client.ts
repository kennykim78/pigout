import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * 외부 의약품/영양 데이터 API 클라이언트
 * - 약학정보원 (KPIS)
 * - 식품의약품안전처 (MFDS)
 * - 식품영양성분 DB
 */

@Injectable()
export class ExternalApiClient {
  // 통합 공공데이터 서비스 키
  private readonly SERVICE_KEY = 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c';
  private readonly RECIPE_KEY = 'e2bed7f054fe4a38863f';

  // 식약처 의약품 개방 API (성공)
  private readonly MFDS_BASE_URL = 'https://apis.data.go.kr/1471000';

  // 식품의약품안전처 레시피 DB (성공)
  private readonly RECIPE_BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api';

  /**
   * 식약처 의약품 개요정보 조회 (e약은요) - 성공한 API
   * @param medicineName 의약품명
   */
  async getMedicineInfo(medicineName: string): Promise<any> {
    try {
      const url = `${this.MFDS_BASE_URL}/DrbEasyDrugInfoService/getDrbEasyDrugList`;
      
      console.log(`[e약은요] 의약품 조회: ${medicineName}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.SERVICE_KEY,
          itemName: medicineName,
          numOfRows: 5,
          pageNo: 1,
          type: 'json',
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data?.header?.resultCode === '00' && response.data?.body?.items) {
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
   * 약물-음식 상호작용 분석
   * e약은요 API의 주의사항(atpnQesitm), 상호작용(intrcQesitm) 정보 활용
   * @param medicineName 약물명
   * @param foodName 음식명 (옵션)
   */
  async analyzeMedicineFoodInteraction(medicineName: string, foodName?: string): Promise<any> {
    try {
      // 1. e약은요 API로 약물 정보 조회
      const medicineInfo = await this.getMedicineInfo(medicineName);
      
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
      
      // 3. 음식 관련 키워드 검색
      const foodKeywords = ['음주', '알코올', '음식', '식사', '공복', '식후', '우유', '커피', '자몽'];
      const foodRelatedInfo = [];
      
      const allText = `${precautions} ${warnings} ${interactions}`.toLowerCase();
      
      for (const keyword of foodKeywords) {
        if (allText.includes(keyword)) {
          foodRelatedInfo.push(keyword);
        }
      }
      
      console.log(`[상호작용] ${medicineName} - 음식 관련 키워드: ${foodRelatedInfo.join(', ')}`);
      
      return {
        medicine: medicine.itemName,
        manufacturer: medicine.entpName,
        food: foodName || '일반 음식',
        hasInteraction: foodRelatedInfo.length > 0,
        riskLevel: warnings.includes('즉시') || warnings.includes('중단') ? 'danger' : 
                   foodRelatedInfo.length > 0 ? 'caution' : 'safe',
        precautions: precautions.split('\n').filter(p => p.trim()),
        warnings: warnings.split('\n').filter(w => w.trim()),
        interactions: interactions.split('\n').filter(i => i.trim()),
        sideEffects: sideEffects.split('\n').filter(s => s.trim()).slice(0, 5), // 상위 5개만
        foodRelatedKeywords: foodRelatedInfo,
        efficacy: medicine.efcyQesitm || '정보 없음',
        usage: medicine.useMethodQesitm || '정보 없음',
        citation: ['식품의약품안전처 의약품개요정보(e약은요)'],
      };
    } catch (error) {
      console.error('[상호작용] 분석 오류:', error.message);
      return {
        medicine: medicineName,
        food: foodName || '정보 없음',
        hasInteraction: false,
        riskLevel: 'error',
        description: '상호작용 분석 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 조리식품 레시피 정보 조회 (COOKRCP01) - 성공한 API
   * 영양성분 정보(칼로리, 나트륨, 탄수화물, 단백질, 지방) 포함
   * @param foodName 음식명
   */
  async getRecipeInfo(foodName: string): Promise<any> {
    try {
      const url = `${this.RECIPE_BASE_URL}/${this.RECIPE_KEY}/COOKRCP01/json/1/10`;
      
      console.log(`[레시피DB] 조회: ${foodName}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data?.COOKRCP01?.RESULT?.CODE === 'INFO-000') {
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
}
