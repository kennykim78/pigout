import { Controller, Get, Query } from '@nestjs/common';
import { OpenDataService } from './opendata.service';

@Controller('opendata')
export class OpenDataController {
  constructor(private readonly openDataService: OpenDataService) {}

  /**
   * 공공데이터 API 테스트 엔드포인트
   * GET /api/opendata/test?foodName=삼겹살
   */
  @Get('test')
  async testApis(@Query('foodName') foodName: string = '삼겹살') {
    console.log('\n========================================');
    console.log(`공공데이터 API 테스트 시작: ${foodName}`);
    console.log('========================================\n');

    const results = {
      foodName,
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // 1. 식품영양성분DB 테스트
    console.log('\n[1/2] 식품영양성분DB 테스트...');
    try {
      const nutritionResult = await this.openDataService.getFoodNutritionInfo(foodName);
      results.tests['foodNutrition'] = {
        success: nutritionResult.success,
        dataCount: nutritionResult.data?.length || 0,
        source: nutritionResult.source,
        note: nutritionResult.note,
        sampleData: nutritionResult.data?.[0],
      };
      console.log('✅ 식품영양성분DB 테스트 완료');
    } catch (error) {
      results.tests['foodNutrition'] = {
        success: false,
        error: error.message,
      };
      console.error('❌ 식품영양성분DB 테스트 실패:', error.message);
    }

    // 2. 레시피DB 테스트
    console.log('\n[2/2] 레시피DB 테스트...');
    try {
      const recipeResult = await this.openDataService.getRecipeInfo(foodName);
      results.tests['recipe'] = {
        success: recipeResult.success,
        dataCount: recipeResult.data?.length || 0,
        source: recipeResult.source,
        note: recipeResult.note,
        sampleData: recipeResult.data?.[0],
      };
      console.log('✅ 레시피DB 테스트 완료');
    } catch (error) {
      results.tests['recipe'] = {
        success: false,
        error: error.message,
      };
      console.error('❌ 레시피DB 테스트 실패:', error.message);
    }

    console.log('\n========================================');
    console.log('테스트 완료');
    console.log('========================================\n');

    return results;
  }

  /**
   * 식품영양성분DB만 테스트
   * GET /api/opendata/test-nutrition?foodName=삼겹살
   */
  @Get('test-nutrition')
  async testNutrition(@Query('foodName') foodName: string = '삼겹살') {
    console.log(`\n식품영양성분DB 단독 테스트: ${foodName}`);
    
    const result = await this.openDataService.getFoodNutritionInfo(foodName);
    
    return {
      foodName,
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * 레시피DB만 테스트
   * GET /api/opendata/test-recipe?foodName=삼겹살
   */
  @Get('test-recipe')
  async testRecipe(@Query('foodName') foodName: string = '삼겹살') {
    console.log(`\n레시피DB 단독 테스트: ${foodName}`);
    
    const result = await this.openDataService.getRecipeInfo(foodName);
    
    return {
      foodName,
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * API URL 및 파라미터 확인
   * GET /api/opendata/debug
   */
  @Get('debug')
  async debugApiUrls(@Query('foodName') foodName: string = '삼겹살') {
    const axios = require('axios');
    
    const nutritionUrl = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq';
    const recipeUrl = 'https://apis.data.go.kr/1390802/AgriFood/FdRecipe/getKoreanFoodRecipe';
    
    const nutritionParams = new URLSearchParams({
      serviceKey: decodeURIComponent(this.openDataService['API_KEYS'].foodNutrition),
      DESC_KOR: foodName,
      type: 'json',
      numOfRows: '5',
      pageNo: '1',
    });
    
    const recipeParams = new URLSearchParams({
      serviceKey: decodeURIComponent(this.openDataService['API_KEYS'].recipeDB),
      RECIPE_NM_KO: foodName,
      type: 'json',
      numOfRows: '3',
      pageNo: '1',
    });
    
    return {
      foodName,
      apis: {
        nutrition: {
          url: nutritionUrl,
          fullUrl: `${nutritionUrl}?${nutritionParams.toString()}`,
          params: Object.fromEntries(nutritionParams.entries()),
        },
        recipe: {
          url: recipeUrl,
          fullUrl: `${recipeUrl}?${recipeParams.toString()}`,
          params: Object.fromEntries(recipeParams.entries()),
        },
      },
      note: '위 URL을 브라우저나 Postman에서 직접 테스트해보세요',
    };
  }
}
