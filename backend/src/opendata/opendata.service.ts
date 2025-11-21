import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenDataService {
  private readonly API_KEYS = {
    foodNutrition: 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    diseaseInfo: 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    medicineInfo: 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    healthFunctionalFood: 'Cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    medicineIdentification: 'Cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    medicineApproval: 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c',
    recipeDB: 'e2bed7f054fe4a38863f', // ✅ 마지막 'f' 추가
  };

  private readonly BASE_URLS = {
    foodNutrition: 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02',
    diseaseInfo: 'https://apis.data.go.kr/B551182/diseaseInfoService1',
    medicineInfo: 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService',
    healthFunctionalFood: 'https://apis.data.go.kr/1471000/HtfsInfoService03',
    medicineIdentification: 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03',
    medicineApproval: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07',
    recipeDB: 'http://openapi.foodsafetykorea.go.kr/api', // ✅ 성공한 레시피 API
  };

  private getApiKey(key: keyof typeof this.API_KEYS) {
    return decodeURIComponent(this.API_KEYS[key]);
  }

  private getResponseBody(data: any) {
    if (!data) return null;
    if (data.body) return data.body;
    if (data.response?.body) return data.response.body;
    return null;
  }

  private normalizeItems(items: any) {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (Array.isArray(items.item)) return items.item;
    if (items.item) return [items.item];
    if (typeof items === 'object') return [items];
    return [];
  }

  /**
   * 식품영양성분DB 정보 조회
   */
  async getFoodNutritionInfo(foodName: string) {
    try {
      const url = `${this.BASE_URLS.foodNutrition}/getFoodNtrCpntDbInq`;
      
      console.log(`식품영양성분DB 조회: ${foodName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('foodNutrition'),
          DESC_KOR: foodName,
          type: 'json',
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('식품영양성분DB 응답 상태:', response.status);
      console.log('식품영양성분DB 응답 데이터:', JSON.stringify(response.data).substring(0, 500));

      const body = this.getResponseBody(response.data);
      const items = this.normalizeItems(body?.items);

      if (items.length) {
        return {
          success: true,
          data: items,
          source: '식품의약품안전처 식품영양성분DB',
        };
      }
      
      if (body?.totalCount === 0 || response.data?.header?.resultCode === '00') {
        return {
          success: true,
          data: [],
          source: '식품의약품안전처 식품영양성분DB',
          note: '검색 결과 없음',
        };
      }
      
      return {
        success: false,
        data: [],
        source: '식품의약품안전처 식품영양성분DB',
        note: response.data?.header?.resultMsg || '데이터 없음'
      };
    } catch (error) {
      console.error('식품영양성분DB 조회 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return {
        success: false,
        data: [],
        source: '식품의약품안전처 식품영양성분DB',
        error: error.message
      };
    }
  }

  /**
   * 건강기능식품 정보 조회 (HtfsInfoService03)
   */
  async getHealthFunctionalFoodInfo(productName: string) {
    try {
      const url = `${this.BASE_URLS.healthFunctionalFood}/getIndivFuncFoodList`;
      
      console.log(`건강기능식품 조회: ${productName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('healthFunctionalFood'),
          prdlst_nm: productName,
          type: 'json',
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('건강기능식품 응답 상태:', response.status);
      console.log('건강기능식품 응답 데이터:', JSON.stringify(response.data).substring(0, 200));
      
      const body = this.getResponseBody(response.data);
      const items = this.normalizeItems(body?.items);

      if (items.length) {
        return {
          success: true,
          data: items,
          source: '식품의약품안전처 건강기능식품정보',
        };
      }
      
      if (response.data?.header?.resultCode === '00') {
        return {
          success: true,
          data: [],
          source: '식품의약품안전처 건강기능식품정보',
          note: '검색 결과 없음',
        };
      }
      
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 건강기능식품정보',
        note: response.data?.header?.resultMsg || '데이터 없음'
      };
    } catch (error) {
      console.error('건강기능식품 조회 오류:', error.message);
      return { success: false, data: [], source: '식품의약품안전처 건강기능식품정보', error: error.message };
    }
  }

  /**
   * 조리식품 레시피 DB 조회 (COOKRCP01 - 성공한 API)
   */
  async getRecipeInfo(foodName: string) {
    try {
      // ✅ 성공한 레시피 API 사용
      const url = `${this.BASE_URLS.recipeDB}/${this.API_KEYS.recipeDB}/COOKRCP01/json/1/10`;
      
      console.log(`레시피DB 조회: ${foodName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('레시피DB 응답 상태:', response.status);

      if (response.data?.COOKRCP01?.RESULT?.CODE === 'INFO-000') {
        const allRecipes = response.data.COOKRCP01.row || [];
        
        // 음식명으로 필터링
        const filteredRecipes = allRecipes.filter(recipe => 
          recipe.RCP_NM?.includes(foodName) || 
          recipe.HASH_TAG?.includes(foodName)
        );
        
        console.log(`레시피DB: 전체 ${allRecipes.length}건 중 ${filteredRecipes.length}건 매칭`);
        
        if (filteredRecipes.length > 0) {
          return {
            success: true,
            data: filteredRecipes,
            source: '식품안전나라 조리식품 레시피DB',
          };
        }
        
        // 매칭 실패 시에도 일부 결과 반환 (영양 정보 활용)
        return {
          success: true,
          data: allRecipes.slice(0, 3),
          source: '식품안전나라 조리식품 레시피DB',
          note: '직접 매칭 실패, 일반 레시피 제공',
        };
      }

      return {
        success: false,
        data: [],
        source: '식품안전나라 조리식품 레시피DB',
        note: '데이터 없음'
      };
    } catch (error) {
      console.error('레시피DB 조회 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return {
        success: false,
        data: [],
        source: '식품안전나라 조리식품 레시피DB',
        error: error.message
      };
    }
  }

  /**
   * 음식에 대한 종합 공공데이터 조회
   */
  async getComprehensiveFoodData(foodName: string) {
    console.log(`\n=== 공공데이터 조회 시작: ${foodName} ===`);
    
    const [nutritionResult, recipeResult] = await Promise.all([
      this.getFoodNutritionInfo(foodName),
      this.getRecipeInfo(foodName),
    ]);

    const sources = [];
    if (nutritionResult.success) sources.push(nutritionResult.source);
    if (recipeResult.success) sources.push(recipeResult.source);

    return {
      foodName,
      nutrition: nutritionResult,
      recipe: recipeResult,
      dataSources: sources,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * 질병 정보 조회 (건강보험심사평가원)
   */
  async getDiseaseInfo(diseaseName: string) {
    try {
      const url = `${this.BASE_URLS.diseaseInfo}/getDiseaseInfo`;
      
      console.log(`질병정보 조회: ${diseaseName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('diseaseInfo'),
          sickNm: diseaseName,
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/xml',
        },
        responseType: 'text',
      });

      console.log('질병정보 응답 상태:', response.status);
      console.log('질병정보 응답 데이터 (XML):', response.data.substring(0, 200));
      
      // XML 응답이므로 성공 여부만 확인
      if (response.status === 200 && response.data) {
        return {
          success: true,
          data: response.data,
          source: '건강보험심사평가원 질병정보서비스',
          format: 'XML',
        };
      }
      
      return { 
        success: false, 
        data: null, 
        source: '건강보험심사평가원 질병정보서비스',
        note: '데이터 없음'
      };
    } catch (error) {
      console.error('질병정보 조회 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return { 
        success: false, 
        data: null, 
        source: '건강보험심사평가원 질병정보서비스', 
        error: error.message 
      };
    }
  }

  /**
   * 의약품 개요정보 조회 (e약은요)
   */
  async getMedicineOverviewInfo(medicineName: string) {
    try {
      const url = `${this.BASE_URLS.medicineInfo}/getDrbEasyDrugList`;
      
      console.log(`의약품 개요정보 조회: ${medicineName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('medicineInfo'),
          itemName: medicineName,
          type: 'json',
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('의약품 개요정보 응답 상태:', response.status);
      console.log('의약품 개요정보 응답 데이터:', JSON.stringify(response.data).substring(0, 200));
      
      const body = this.getResponseBody(response.data);
      const items = this.normalizeItems(body?.items);

      if (items.length) {
        return {
          success: true,
          data: items,
          source: '식품의약품안전처 의약품개요정보(e약은요)',
        };
      }
      
      if (response.data?.header?.resultCode === '00') {
        return {
          success: true,
          data: [],
          source: '식품의약품안전처 의약품개요정보(e약은요)',
          note: '검색 결과 없음',
        };
      }
      
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 의약품개요정보(e약은요)',
        note: response.data?.header?.resultMsg || '데이터 없음'
      };
    } catch (error) {
      console.error('의약품 개요정보 조회 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 의약품개요정보(e약은요)', 
        error: error.message 
      };
    }
  }

  /**
   * 약품 정보 조회 (낱알식별 - MdcinGrnIdntfcInfoService03)
   */
  async getMedicineIdentificationInfo(medicineName: string) {
    try {
      const url = `${this.BASE_URLS.medicineIdentification}/getMdcinGrnIdntfcInfoList`;
      
      console.log(`의약품 낱알식별 조회: ${medicineName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('medicineIdentification'),
          item_name: medicineName,
          type: 'json',
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('의약품 낱알식별 응답 상태:', response.status);
      console.log('의약품 낱알식별 응답 데이터:', JSON.stringify(response.data).substring(0, 200));
      
      const body = this.getResponseBody(response.data);
      const items = this.normalizeItems(body?.items);

      if (items.length) {
        return {
          success: true,
          data: items,
          source: '식품의약품안전처 의약품 낱알식별정보',
        };
      }
      
      if (response.data?.header?.resultCode === '00') {
        return {
          success: true,
          data: [],
          source: '식품의약품안전처 의약품 낱알식별정보',
          note: '검색 결과 없음',
        };
      }
      
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 의약품 낱알식별정보',
        note: response.data?.header?.resultMsg || '데이터 없음'
      };
    } catch (error) {
      console.error('의약품 낱알식별 조회 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 의약품 낱알식별정보', 
        error: error.message 
      };
    }
  }

  /**
   * 약품 정보 조회 (구버전 - 호환성 유지)
   */
  async getMedicineInfo(medicineName: string) {
    return this.getMedicineIdentificationInfo(medicineName);
  }

  /**
   * 약품 허가 정보 조회 (DrugPrdtPrmsnInfoService07)
   */
  async getMedicineApprovalInfo(medicineName: string) {
    try {
      const url = `${this.BASE_URLS.medicineApproval}/getDrugPrdtPrmsnInq`;
      
      console.log(`의약품 제품허가정보 조회: ${medicineName}`);
      console.log(`API URL: ${url}`);
      
      const response = await axios.get(url, {
        params: {
          serviceKey: this.getApiKey('medicineApproval'),
          item_name: medicineName,
          type: 'json',
          numOfRows: 5,
          pageNo: 1,
        },
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('의약품 제품허가정보 응답 상태:', response.status);
      console.log('의약품 제품허가정보 응답 데이터:', JSON.stringify(response.data).substring(0, 200));
      
      const body = this.getResponseBody(response.data);
      const items = this.normalizeItems(body?.items);

      if (items.length) {
        return {
          success: true,
          data: items,
          source: '식품의약품안전처 의약품 제품허가정보',
        };
      }
      
      if (response.data?.header?.resultCode === '00') {
        return {
          success: true,
          data: [],
          source: '식품의약품안전처 의약품 제품허가정보',
          note: '검색 결과 없음',
        };
      }
      
      return { 
        success: false, 
        data: [], 
        source: '식품의약품안전처 의약품 제품허가정보',
        note: response.data?.header?.resultMsg || '데이터 없음'
      };
    } catch (error) {
      console.error('의약품 허가정보 조회 오류:', error.message);
      return { success: false, data: [], source: '식품의약품안전처 의약품 제품허가정보', error: error.message };
    }
  }
}
