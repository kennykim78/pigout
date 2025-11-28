import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { OpenDataService } from '../opendata/opendata.service';
import { ExternalApiClient } from '../ai/utils/external-api.client';
import { UsersService } from '../users/users.service';

@Injectable()
export class FoodService {
  private geminiClient: any = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly openDataService: OpenDataService,
    private readonly externalApiClient: ExternalApiClient,
    private readonly usersService: UsersService,
  ) {}

  private async getGeminiClient() {
    if (!this.geminiClient) {
      const { GeminiClient } = await import('../ai/utils/gemini.client');
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
      }
      this.geminiClient = new GeminiClient(geminiApiKey);
    }
    return this.geminiClient;
  }

  async analyzeFood(foodName: string, image?: Express.Multer.File, diseases: string[] = []) {
    try {
      let imageUrl = null;
      let actualFoodName = foodName;

      // 이미지가 있으면 업로드 및 AI 분석
      if (image) {
        try {
          // 파일 확장자 추출
          const fileExtension = image.originalname.split('.').pop() || 'jpg';
          // 안전한 파일명 생성 (타임스탬프 + 랜덤 문자열)
          const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
          const uploadResult = await this.supabaseService.uploadImage(
            image.buffer,
            safeFileName,
          );
          imageUrl = uploadResult.publicUrl;
          console.log('이미지 업로드 성공:', imageUrl);

          // AI로 이미지 분석하여 음식명 추출
          console.log('AI 이미지 분석 시작...');
          const imageBase64 = image.buffer.toString('base64');
          
          // Gemini Vision API 호출
          const { GeminiClient } = await import('../ai/utils/gemini.client');
          const geminiApiKey = process.env.GEMINI_API_KEY;
          if (!geminiApiKey) {
            console.warn('GEMINI_API_KEY가 설정되지 않음. 기본 음식명 사용.');
          } else {
            const geminiClient = new GeminiClient(geminiApiKey);
            const visionResult = await geminiClient.analyzeImageForFood(imageBase64);
            
            console.log('AI 분석 결과:', visionResult);
            
            // 유효하지 않은 이미지 거부
            if (!visionResult.isValid) {
              throw new HttpException(
                visionResult.rejectReason || '촬영하신 이미지가 음식이나, 약품, 건강보조제가 아닙니다.',
                HttpStatus.BAD_REQUEST,
              );
            }
            
            // AI가 추출한 음식명 사용
            actualFoodName = visionResult.itemName;
            console.log('AI가 추출한 음식명:', actualFoodName);
          }
        } catch (uploadError) {
          if (uploadError instanceof HttpException) {
            throw uploadError; // 유효성 검증 에러는 그대로 던짐
          }
          console.warn('이미지 처리 실패 (계속 진행):', uploadError.message);
          // 이미지 처리 실패해도 분석은 계속 진행
        }
      }

      // AI 분석 로직 - 질병 정보 포함
      console.log('음식명:', actualFoodName);
      console.log('질병 정보:', diseases);
      
      // AI 분석 전 공공데이터 조회
      console.log('=== 공공데이터 조회 시작 ===');
      const publicData = await this.openDataService.getComprehensiveFoodData(actualFoodName);
      console.log('공공데이터 조회 완료:', publicData);
      
      // Gemini Flash로 공공데이터 기반 분석 수행
      let score = 70;
      let analysis = `${actualFoodName}에 대한 분석 결과입니다.`;
      let detailedAnalysis = null;
      
      try {
        const { GeminiClient } = await import('../ai/utils/gemini.client');
        const geminiApiKey = process.env.GEMINI_API_KEY;
        
        if (geminiApiKey) {
          const geminiClient = new GeminiClient(geminiApiKey);
          
          // 공공데이터 기반 간단 분석 (Flash 모델)
          const simpleAnalysis = await geminiClient.analyzeFoodSuitability(
            actualFoodName,
            diseases,
            publicData.nutrition.data, // 영양성분 데이터
            publicData // 전체 공공데이터
          );
          
          console.log('Gemini 분석 결과:', simpleAnalysis);
          
          // AI가 계산한 적합도 점수 직접 사용
          score = simpleAnalysis.suitabilityScore || 65;
          
          console.log(`AI가 계산한 적합도 점수: ${score}`);
          
          // 간단 분석 텍스트 생성
          const diseaseNote = diseases.length > 0 
            ? `\n\n선택하신 질병(${diseases.join(', ')})을 고려한 분석입니다.` 
            : '';
          
          analysis = `${simpleAnalysis.summary || actualFoodName + '에 대한 분석'}${diseaseNote}`;
          
          // 상세 분석 - AI가 생성한 데이터 + 공공데이터 출처
          detailedAnalysis = {
            pros: simpleAnalysis.pros || [
              `${actualFoodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
              '다양한 식재료와 함께 드시면 영양 균형을 맞출 수 있습니다.'
            ],
            cons: simpleAnalysis.cons || [
              '과도한 섭취는 피하시는 것이 좋습니다.',
              '균형잡힌 식단의 일부로 섭취하세요.'
            ],
            summary: simpleAnalysis.summary || '',
            cookingTips: simpleAnalysis.cookingTips || [
              '신선한 재료를 사용하세요',
              '조리 시 염분과 당분을 적게 사용하세요',
              '채소를 많이 추가하면 더 건강해요'
            ],
            dataSources: simpleAnalysis.dataSources || publicData.dataSources || []
          };
          
          console.log('AI 분석 완료 - 적합도 점수:', score);
          console.log('간단 분석:', analysis);
          console.log('상세 분석:', detailedAnalysis);
        } else {
          console.warn('GEMINI_API_KEY 없음 - 기본 분석 사용');
        }
      } catch (aiError) {
        console.error('AI 분석 중 오류 (기본값 사용):', aiError.message);
        
        // AI 실패 시에도 유용한 기본 분석 제공
        const diseaseNote = diseases.length > 0 
          ? `\n\n선택하신 질병(${diseases.join(', ')})을 고려하여 섭취량에 주의해주세요.` 
          : '';
        
        analysis = `${actualFoodName}에 대한 분석입니다. 균형있게 섭취하시면 좋습니다.${diseaseNote}`;
        
        detailedAnalysis = {
          pros: [
            `${actualFoodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
            '다양한 식재료와 함께 드시면 영양 균형을 맞출 수 있습니다.'
          ],
          cons: diseases.length > 0 
            ? [
                `${diseases.join(', ')} 질환이 있으시다면 섭취량에 주의가 필요합니다.`,
                '과도한 섭취는 피하시는 것이 좋습니다.'
              ]
            : [
                '과도한 섭취는 피하시는 것이 좋습니다.',
                '균형잡힌 식단의 일부로 섭취하세요.'
              ],
          summary: `${actualFoodName}은(는) 균형있게 섭취하시면 좋습니다.`,
          cookingTips: [
            '신선한 재료를 사용하세요',
            '조리 시 염분과 당분을 적게 사용하세요',
            '채소를 많이 추가하면 더 건강해요'
          ]
        };
      }

      // 데이터베이스에 저장 (상세 분석 포함)
      console.log('DB 저장 데이터:', { foodName: actualFoodName, score, analysis: analysis.substring(0, 50) + '...' });
      
      const result = await this.supabaseService.saveFoodAnalysis({
        foodName: actualFoodName,
        imageUrl,
        score,
        analysis,
        diseases,
        detailedAnalysis: detailedAnalysis ? JSON.stringify(detailedAnalysis) : null,
      });

      console.log('DB 저장 완료:', result[0]);

      // 응답 데이터를 camelCase로 변환
      const responseData = {
        id: result[0].id,
        foodName: result[0].food_name,
        imageUrl: result[0].image_url,
        score: result[0].score,
        analysis: result[0].analysis,
        detailedAnalysis: detailedAnalysis, // 메모리에서만 전달
        createdAt: result[0].created_at,
      };

      console.log('>>> 클라이언트로 전송할 최종 응답:', {
        success: true,
        data: responseData,
        message: '음식 분석이 완료되었습니다.'
      });

      return {
        success: true,
        data: responseData,
        message: '음식 분석이 완료되었습니다.',
      };
    } catch (error) {
      console.error('음식 분석 오류:', error);
      
      // HttpException인 경우 그대로 던지기
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error.message || '음식 분석 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeFoodByText(foodName: string, diseases: string[] = [], deviceId?: string) {
    try {
      // 텍스트만으로 분석 - 질병 정보 포함
      console.log('=== 음식 분석 시작 ===');
      console.log('음식명:', foodName);
      console.log('질병 정보:', diseases);
      console.log('기기 ID:', deviceId);
      
      // 기기 ID로 사용자 ID 조회 (없으면 기본값 사용)
      let userId = '00000000-0000-0000-0000-000000000000';
      if (deviceId) {
        const foundUserId = await this.usersService.getUserIdByDeviceId(deviceId);
        if (foundUserId) {
          userId = foundUserId;
          console.log('사용자 ID:', userId);
        } else {
          // 기기 등록되지 않은 경우 자동 등록
          const newUser = await this.usersService.findOrCreateByDeviceId(deviceId);
          userId = newUser.id;
          console.log('새 사용자 자동 등록:', userId);
        }
      }
      
      // 1단계: 사용자 약물 정보 조회
      const supabase = this.supabaseService.getClient();
      const { data: medicines } = await supabase
        .from('medicine_records')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      console.log(`\n[1단계] 복용 약물: ${medicines?.length || 0}개`);
      
      // 2단계: e약은요 API로 각 약물의 상세 정보 조회 (핵심 API만 사용)
      // - 낱알식별, 허가정보 API 제거 (중복 + API 사용량 절약)
      // - e약은요에 주의사항, 상호작용, 효능 모두 포함됨
      const drugDetailsPromises = (medicines || []).map(async (medicine: any) => {
        try {
          const info = await this.externalApiClient.getMedicineInfo(medicine.name, 3);
          const publicData = Array.isArray(info) && info.length > 0 ? info[0] : null;

          return {
            name: medicine.name,
            userMedicineId: medicine.id,
            publicData,
            // API 소진 시 AI가 대체할 수 있도록 플래그 추가
            dataSource: publicData ? 'e약은요' : 'AI분석필요',
          };
        } catch (error) {
          console.warn(`[e약은요] ${medicine.name} 조회 실패, AI가 대체 분석:`, error.message);
          return {
            name: medicine.name,
            userMedicineId: medicine.id,
            publicData: null,
            dataSource: 'AI분석필요',
          };
        }
      });
      
      const drugDetails = await Promise.all(drugDetailsPromises);
      const apiSuccessCount = drugDetails.filter(d => d.dataSource === 'e약은요').length;
      const aiNeededCount = drugDetails.filter(d => d.dataSource === 'AI분석필요').length;
      console.log(`\n[2단계] 약물 정보 조회 완료 (e약은요: ${apiSuccessCount}개, AI대체필요: ${aiNeededCount}개)`);

      // 보강 데이터: 식품영양성분 + 건강기능식품 API 조회
      // - 식품영양성분: 정확한 영양소 수치 확인
      // - 건강기능식품: 건강기능식품 검색 시 활용
      console.log(`\n[보강 데이터] 식품영양성분 / 건강기능식품 API 조회 중...`);
      
      let nutritionRows = [];
      let healthFoodRows = [];
      
      try {
        [nutritionRows, healthFoodRows] = await Promise.all([
          this.externalApiClient.getFoodNutritionPublicData({ foodName, numOfRows: 5 }),
          this.externalApiClient.getHealthFunctionalFoodList({ productName: foodName, numOfRows: 5 }),
        ]);
      } catch (apiError) {
        console.warn('[보강 데이터] API 조회 실패, AI가 대체:', apiError.message);
      }
      
      const supplementalPublicData = {
        nutrition: {
          source: nutritionRows?.length > 0 ? '식품의약품안전처 식품영양성분DB' : 'AI 지식 기반',
          items: nutritionRows || [],
        },
        healthFunctionalFoods: {
          source: healthFoodRows?.length > 0 ? '식품의약품안전처 건강기능식품정보' : 'AI 지식 기반',
          items: healthFoodRows || [],
        },
        diseaseInfo: { source: 'AI 지식 기반', items: [] },
      };
      
      console.log('[보강 데이터] 결과:', {
        nutritionCount: nutritionRows?.length || 0,
        healthFoodCount: healthFoodRows?.length || 0,
      });
      
      // 3단계 + 4단계 + 레시피 조회: 병렬 실행으로 속도 최적화
      const geminiClient = await this.getGeminiClient();
      
      console.log(`\n[3-4단계] AI 분석 + 레시피 조회 병렬 실행 중...`);
      
      // 3단계: 음식 성분 분석 (Promise)
      const foodAnalysisPromise = geminiClient.analyzeFoodComponents(foodName, diseases, supplementalPublicData);
      
      // 레시피 DB 조회 (Promise) - 미리 시작
      const recipeDataPromise = this.externalApiClient.getRecipeInfo(foodName);
      
      // 3단계 완료 대기 (4단계에 필요)
      const foodAnalysis = await foodAnalysisPromise;
      console.log('[3단계] 음식 성분 분석 완료:', {
        주요성분: foodAnalysis.components?.slice(0, 3),
        위험요소: Object.keys(foodAnalysis.riskFactors || {}).filter(k => foodAnalysis.riskFactors[k])
      });
      
      // 4단계: 약물-음식 상호작용 분석 (3단계 결과 필요)
      console.log(`\n[4단계] AI가 약물-음식 상호작용 분석 중...`);
      const interactionAnalysis = await geminiClient.analyzeDrugFoodInteractions(
        foodName,
        foodAnalysis,
        drugDetails,
        diseases
      );
      
      console.log('[4단계] 상호작용 분석 완료:', {
        위험약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'danger').length,
        주의약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'caution').length,
        안전약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'safe').length
      });
      
      // 레시피 데이터 완료 대기 (병렬 실행됨)
      const recipeData = await recipeDataPromise;
      console.log(`[레시피] 조회 완료: ${recipeData?.length || 0}개`);
      
      // 5단계: AI가 최종 종합 분석 + 레시피 팁 통합 (하나의 AI 호출로 통합)
      console.log(`\n[5단계] AI가 최종 분석 + 레시피 팁 통합 생성 중...`);
      const { finalAnalysis, healthyRecipes } = await geminiClient.generateFinalAnalysisWithRecipes(
        foodName,
        foodAnalysis,
        interactionAnalysis,
        diseases,
        recipeData
      );
      
      const score = finalAnalysis.suitabilityScore || 50;
      const analysis = finalAnalysis.briefSummary || `${foodName}에 대한 분석 결과입니다.`;
      
      // 7단계: 데이터 소스 정리 (사용한 API만 표시)
      const dataSourceSet = new Set<string>([
        'Gemini AI 분석',
      ]);
      
      // e약은요 API 성공한 경우만 출처 추가
      if (apiSuccessCount > 0) {
        dataSourceSet.add('식품의약품안전처 e약은요 API');
      }
      
      // 식품영양성분 API 사용한 경우
      if (nutritionRows && nutritionRows.length > 0) {
        dataSourceSet.add('식품의약품안전처 식품영양성분DB');
      }
      
      // 건강기능식품 API 사용한 경우
      if (healthFoodRows && healthFoodRows.length > 0) {
        dataSourceSet.add('식품의약품안전처 건강기능식품정보');
      }
      
      // 레시피 데이터 사용한 경우
      if (healthyRecipes && healthyRecipes.length > 0) {
        dataSourceSet.add('식품안전나라 조리식품 레시피DB');
      }

      const detailedAnalysis: any = {
        // 새로운 형식: 좋은점, 주의점, 경고, 전문가조언, 종합분석
        goodPoints: finalAnalysis.goodPoints || [],           // ✅ 좋은 점
        badPoints: finalAnalysis.badPoints || [],             // ⚠️ 주의할 점
        warnings: finalAnalysis.warnings || [],               // 🚨 경고
        expertAdvice: finalAnalysis.expertAdvice || '',       // 💊 AI 전문가 조언
        summary: finalAnalysis.summary || analysis,           // 🔬 최종 종합 분석
        
        // 기존 호환성 유지
        pros: finalAnalysis.goodPoints || [],
        cons: finalAnalysis.badPoints || [],
        
        cookingTips: healthyRecipes || [],
        medicalAnalysis: {
          drug_food_interactions: interactionAnalysis.interactions || []
        },
        foodComponents: foodAnalysis.components || [],
        riskFactors: foodAnalysis.riskFactors || {},
        riskFactorNotes: foodAnalysis.riskFactorNotes || {},
        publicDatasets: supplementalPublicData,
        dataSources: Array.from(dataSourceSet),
        // API 사용 현황 추가
        apiUsage: {
          eDrugApi: { used: apiSuccessCount, aiReplaced: aiNeededCount },
          nutritionApi: { used: nutritionRows?.length > 0 ? 1 : 0 },
          healthFoodApi: { used: healthFoodRows?.length > 0 ? 1 : 0 },
          recipeApi: { used: recipeData?.length > 0 ? 1 : 0 },
        }
      };
      
      console.log('\n[6단계] 최종 결과 정리 완료');
      console.log('점수:', score);
      console.log('약물 상호작용:', detailedAnalysis.medicalAnalysis.drug_food_interactions.length, '개');
      console.log('=== 음식 분석 완료 ===\n');

      console.log('DB 저장 데이터:', { foodName, score, analysis: analysis.substring(0, 50) + '...', userId });

      const result = await this.supabaseService.saveFoodAnalysis({
        foodName,
        score,
        analysis,
        diseases,
        userId,
        detailedAnalysis: detailedAnalysis ? JSON.stringify(detailedAnalysis) : null,
      });

      console.log('DB 저장 완료:', result[0]);

      // 응답 데이터를 camelCase로 변환
      const responseData = {
        id: result[0].id,
        foodName: result[0].food_name,
        imageUrl: result[0].image_url,
        score: result[0].score,
        analysis: result[0].analysis,
        detailedAnalysis: detailedAnalysis, // 메모리에서만 전달
        createdAt: result[0].created_at,
      };

      return {
        success: true,
        data: responseData,
        message: '음식 분석이 완료되었습니다.',
      };
    } catch (error) {
      console.error('텍스트 분석 오류:', error);
      throw new HttpException(
        error.message || '음식 분석 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 경량 텍스트 분석: 공공데이터 없이 순수 AI 지식만으로 빠른 분석
  async simpleAnalyzeFoodByText(foodName: string, diseases: string[] = [], deviceId?: string) {
    try {
      console.log('=== 순수 AI 빠른 분석 시작 ===');
      console.log('음식명 (원본):', foodName);
      console.log('질병 정보:', diseases);

      // 기기 ID로 사용자 ID 조회 (없으면 기본값 사용)
      let userId = '00000000-0000-0000-0000-000000000000';
      if (deviceId) {
        const foundUserId = await this.usersService.getUserIdByDeviceId(deviceId);
        if (foundUserId) {
          userId = foundUserId;
        } else {
          const newUser = await this.usersService.findOrCreateByDeviceId(deviceId);
          userId = newUser.id;
        }
      }
      
      // 사용자 복용 약물 목록 조회 (간단히 이름만)
      const supabase = this.supabaseService.getClient();
      const { data: medicines } = await supabase
        .from('medicine_records')
        .select('name')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const medicineNames = (medicines || []).map((m: any) => m.name);
      console.log('[순수AI] 복용 약물:', medicineNames);

      // ================================================================
      // 1단계: 규칙 기반 분석 시도 (AI 호출 없음!)
      // ================================================================
      if (canUseRuleBasedAnalysis(foodName)) {
        const ruleResult = getRuleBasedAnalysis(foodName, diseases, medicineNames);
        if (ruleResult) {
          console.log(`[규칙기반] ✅ "${foodName}" 규칙 기반 분석 완료 (AI 비용: $0)`);
          
          // DB에 저장 (사용자 히스토리용)
          const result = await this.supabaseService.saveFoodAnalysis({
            foodName,
            score: ruleResult.score,
            analysis: ruleResult.analysis,
            diseases,
            userId,
            detailedAnalysis: JSON.stringify(ruleResult.detailedAnalysis),
          });

          return {
            success: true,
            data: {
              id: result[0].id,
              foodName: result[0].food_name,
              score: result[0].score,
              analysis: result[0].analysis,
              detailedAnalysis: ruleResult.detailedAnalysis,
              createdAt: result[0].created_at,
            },
            message: 'AI 빠른 분석이 완료되었습니다. (규칙 기반)',
            analysisMode: 'rule-based',
          };
        }
      }
      console.log('[규칙기반] 해당 음식 없음, AI 분석 진행...');
      // ================================================================

      // ================================================================
      // 2단계: 음식명 정규화 (캐시 히트율 향상)
      // ================================================================
      const geminiClient = await this.getGeminiClient();
      const normalized = await geminiClient.normalizeFoodName(foodName);
      const normalizedFoodName = normalized.normalized;
      console.log(`[정규화] "${foodName}" → "${normalizedFoodName}" (신뢰도: ${normalized.confidence})`);
      // ================================================================

      // ================================================================
      // 3단계: 캐시 체크 (정규화된 음식명으로)
      // ================================================================
      const cacheKey = this.supabaseService.generateCacheKey(normalizedFoodName, diseases, medicineNames);
        .eq('is_active', true);
      
      const medicineNames = (medicines || []).map((m: any) => m.name);
      console.log('[순수AI] 복용 약물:', medicineNames);

      // ================================================================
      // 캐시 체크: 정규화된 음식명으로 캐시 조회
      // ================================================================
      const cacheKey = this.supabaseService.generateCacheKey(normalizedFoodName, diseases, medicineNames);
      console.log(`[Cache] 캐시 키: ${cacheKey.substring(0, 16)}...`);
      
      const cachedResult = await this.supabaseService.getCachedAnalysis(cacheKey);
      if (cachedResult) {
        console.log(`[Cache] ✅ 캐시 히트! 기존 분석 결과 사용 (히트 횟수: ${cachedResult.hit_count})`);
        
        // 캐시된 결과로 응답 구성 (새로운 food_analysis 레코드 생성)
        // 원본 음식명으로 저장 (사용자 히스토리용)
        const result = await this.supabaseService.saveFoodAnalysis({
          foodName: foodName, // 원본 음식명 저장
          score: cachedResult.score,
          analysis: cachedResult.analysis,
          diseases,
          userId,
        });

        const responseData = {
          id: result[0].id,
          foodName: foodName, // 사용자에게는 원본 음식명 표시
          score: result[0].score,
          analysis: result[0].analysis,
          detailedAnalysis: {
            ...cachedResult.detailed_analysis,
            cached: true,
            cacheHitCount: cachedResult.hit_count,
            normalizedFrom: normalizedFoodName !== foodName ? normalizedFoodName : undefined,
          },
          createdAt: result[0].created_at,
        };

        return {
          success: true,
          data: responseData,
          message: 'AI 빠른 분석이 완료되었습니다. (캐시)',
          cached: true,
        };
      }
      
      console.log('[Cache] 캐시 미스. 새로운 AI 분석 수행...');
      // ================================================================

      // Gemini AI로 순수 지식 기반 빠른 분석 (공공데이터 조회 없음!)
      const aiAnalysis = await geminiClient.quickAIAnalysis(
        foodName,
        diseases,
        medicineNames
      );
      console.log('[순수AI] Gemini 분석 완료');

      const score = aiAnalysis.suitabilityScore || 60;
      
      // 간결한 분석 텍스트 생성 (각 항목 1줄씩)
      const parts = [aiAnalysis.summary || `${foodName} 분석 결과`];
      if (aiAnalysis.pros) parts.push(`✅ ${aiAnalysis.pros}`);
      if (aiAnalysis.cons) parts.push(`⚠️ ${aiAnalysis.cons}`);
      if (aiAnalysis.warnings) parts.push(`🚨 ${aiAnalysis.warnings}`);
      if (aiAnalysis.expertAdvice) parts.push(`💊 ${aiAnalysis.expertAdvice}`);
      
      const analysis = parts.join('\n');

      // 경량 결과 구성 (공공데이터 출처 없음)
      const lightweightDetails = {
        pros: aiAnalysis.pros || '',
        cons: aiAnalysis.cons || '',
        summary: aiAnalysis.summary || analysis,
        warnings: aiAnalysis.warnings || '',
        expertAdvice: aiAnalysis.expertAdvice || '',
        // 공공데이터 미사용 표시
        dataSources: ['AI 전문가 분석 (Gemini)'],
        mode: 'quick-ai',
      };

      // ================================================================
      // 캐시 저장: 정규화된 음식명으로 저장 (캐시 히트율 향상)
      // ================================================================
      await this.supabaseService.saveCachedAnalysis({
        cacheKey,
        foodName: normalizedFoodName, // 정규화된 음식명으로 캐시 저장
        diseases,
        medicines: medicineNames,
        score,
        analysis,
        detailedAnalysis: lightweightDetails,
        analysisMode: 'quick-ai',
      });
      // ================================================================

      // DB 저장
      const result = await this.supabaseService.saveFoodAnalysis({
        foodName,
        score,
        analysis,
        diseases,
        userId,
      });

      const responseData = {
        id: result[0].id,
        foodName: result[0].food_name,
        score: result[0].score,
        analysis: result[0].analysis,
        detailedAnalysis: lightweightDetails,
        createdAt: result[0].created_at,
      };

      console.log('=== 순수 AI 빠른 분석 완료 ===');
      return {
        success: true,
        data: responseData,
        message: 'AI 빠른 분석이 완료되었습니다.',
      };
    } catch (error) {
      console.error('simpleAnalyzeFoodByText 오류:', error);
      throw new HttpException(
        error.message || '빠른 음식 분석 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 이미지 포함 빠른 AI 분석 (공공데이터 없음) - Result01용
  async simpleAnalyzeFood(foodName: string, image?: Express.Multer.File, diseases: string[] = [], deviceId?: string) {
    try {
      console.log('=== 이미지 포함 빠른 AI 분석 시작 ===');
      let imageUrl = null;
      let actualFoodName = foodName;

      // 이미지가 있으면 업로드 및 음식명 추출만
      if (image) {
        try {
          const fileExtension = image.originalname.split('.').pop() || 'jpg';
          const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
          const uploadResult = await this.supabaseService.uploadImage(
            image.buffer,
            safeFileName,
          );
          imageUrl = uploadResult.publicUrl;
          console.log('[simpleAnalyze] 이미지 업로드 성공:', imageUrl);

          // AI로 음식명만 추출 (빠르게)
          const imageBase64 = image.buffer.toString('base64');
          const geminiClient = await this.getGeminiClient();
          const visionResult = await geminiClient.analyzeImageForFood(imageBase64);
          
          if (!visionResult.isValid) {
            throw new HttpException(
              visionResult.rejectReason || '촬영하신 이미지가 음식이나, 약품, 건강보조제가 아닙니다.',
              HttpStatus.BAD_REQUEST,
            );
          }
          
          // foodName이 비어있으면 AI 추출 사용, 아니면 사용자 입력 우선
          if (!foodName || foodName.trim() === '') {
            actualFoodName = visionResult.itemName;
          }
          console.log('[simpleAnalyze] 최종 음식명:', actualFoodName);
        } catch (uploadError) {
          if (uploadError instanceof HttpException) {
            throw uploadError;
          }
          console.warn('[simpleAnalyze] 이미지 처리 실패 (계속 진행):', uploadError.message);
        }
      }

      console.log('[simpleAnalyze] 음식명:', actualFoodName);
      console.log('[simpleAnalyze] 질병:', diseases);

      // 기기 ID로 사용자 ID 조회 (없으면 기본값 사용)
      let userId = '00000000-0000-0000-0000-000000000000';
      if (deviceId) {
        const foundUserId = await this.usersService.getUserIdByDeviceId(deviceId);
        if (foundUserId) {
          userId = foundUserId;
        } else {
          const newUser = await this.usersService.findOrCreateByDeviceId(deviceId);
          userId = newUser.id;
        }
      }
      const supabase = this.supabaseService.getClient();
      const { data: medicines } = await supabase
        .from('medicine_records')
        .select('name')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const medicineNames = (medicines || []).map((m: any) => m.name);
      console.log('[simpleAnalyze] 복용 약물:', medicineNames);

      // ================================================================
      // 캐시 체크: 동일한 음식+질병+약물 조합이 캐시에 있는지 확인
      // ================================================================
      const cacheKey = this.supabaseService.generateCacheKey(actualFoodName, diseases, medicineNames);
      console.log(`[Cache] 캐시 키: ${cacheKey.substring(0, 16)}...`);
      
      const cachedResult = await this.supabaseService.getCachedAnalysis(cacheKey);
      if (cachedResult) {
        console.log(`[Cache] ✅ 캐시 히트! 기존 분석 결과 사용 (히트 횟수: ${cachedResult.hit_count})`);
        
        // 캐시된 결과로 응답 구성 (새로운 food_analysis 레코드 생성)
        const result = await this.supabaseService.saveFoodAnalysis({
          foodName: cachedResult.food_name,
          imageUrl,
          score: cachedResult.score,
          analysis: cachedResult.analysis,
          diseases,
          userId,
        });

        const responseData = {
          id: result[0].id,
          foodName: result[0].food_name,
          imageUrl: result[0].image_url,
          score: result[0].score,
          analysis: result[0].analysis,
          detailedAnalysis: {
            ...cachedResult.detailed_analysis,
            cached: true,
            cacheHitCount: cachedResult.hit_count,
          },
          createdAt: result[0].created_at,
        };

        return {
          success: true,
          data: responseData,
          message: 'AI 빠른 분석이 완료되었습니다. (캐시)',
          cached: true,
        };
      }
      
      console.log('[Cache] 캐시 미스. 새로운 AI 분석 수행...');
      // ================================================================

      // 순수 AI 분석 (공공데이터 조회 없음!)
      const geminiClient = await this.getGeminiClient();
      const aiAnalysis = await geminiClient.quickAIAnalysis(
        actualFoodName,
        diseases,
        medicineNames
      );
      console.log('[simpleAnalyze] AI 분석 완료');

      const score = aiAnalysis.suitabilityScore || 60;
      
      // 간결한 분석 텍스트 생성 (각 항목 1줄씩)
      const parts = [aiAnalysis.summary || `${actualFoodName} 분석 결과`];
      if (aiAnalysis.pros) parts.push(`✅ ${aiAnalysis.pros}`);
      if (aiAnalysis.cons) parts.push(`⚠️ ${aiAnalysis.cons}`);
      if (aiAnalysis.warnings) parts.push(`🚨 ${aiAnalysis.warnings}`);
      if (aiAnalysis.expertAdvice) parts.push(`💊 ${aiAnalysis.expertAdvice}`);
      
      const analysis = parts.join('\n');

      const lightweightDetails = {
        pros: aiAnalysis.pros || '',
        cons: aiAnalysis.cons || '',
        summary: aiAnalysis.summary || analysis,
        warnings: aiAnalysis.warnings || '',
        expertAdvice: aiAnalysis.expertAdvice || '',
        dataSources: ['AI 전문가 분석 (Gemini)'],
        mode: 'quick-ai',
      };

      // ================================================================
      // 캐시 저장: 다음 동일 요청을 위해 결과 캐싱
      // ================================================================
      await this.supabaseService.saveCachedAnalysis({
        cacheKey,
        foodName: actualFoodName,
        diseases,
        medicines: medicineNames,
        score,
        analysis,
        detailedAnalysis: lightweightDetails,
        analysisMode: 'quick-ai',
      });
      // ================================================================

      // DB 저장
      const result = await this.supabaseService.saveFoodAnalysis({
        foodName: actualFoodName,
        imageUrl,
        score,
        analysis,
        diseases,
        userId,
      });

      const responseData = {
        id: result[0].id,
        foodName: result[0].food_name,
        imageUrl: result[0].image_url,
        score: result[0].score,
        analysis: result[0].analysis,
        detailedAnalysis: lightweightDetails,
        createdAt: result[0].created_at,
      };

      console.log('=== 이미지 포함 빠른 AI 분석 완료 ===');
      return {
        success: true,
        data: responseData,
        message: 'AI 빠른 분석이 완료되었습니다.',
      };
    } catch (error) {
      console.error('simpleAnalyzeFood 오류:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || '빠른 음식 분석 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getFoodAnalysis(id: string) {
    const data = await this.supabaseService.getFoodAnalysis(id);
    return {
      success: true,
      data,
    };
  }

  async quickAnalyzeImage(imageBase64: string) {
    try {
      console.log('빠른 이미지 분석 시작...');
      
      // Gemini Vision API로 음식명만 추출
      const { GeminiClient } = await import('../ai/utils/gemini.client');
      const geminiApiKey = process.env.GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        throw new HttpException(
          'GEMINI_API_KEY가 설정되지 않았습니다.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const geminiClient = new GeminiClient(geminiApiKey);
      const visionResult = await geminiClient.analyzeImageForFood(imageBase64);
      
      console.log('빠른 분석 결과:', visionResult);
      
      if (!visionResult.isValid) {
        return {
          success: false,
          foodName: null,
          message: visionResult.rejectReason,
        };
      }
      
      return {
        success: true,
        foodName: visionResult.itemName,
        category: visionResult.category,
        confidence: visionResult.confidence,
      };
    } catch (error) {
      console.error('빠른 분석 오류:', error);
      throw new HttpException(
        error.message || '이미지 분석 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
