import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { OpenDataService } from '../opendata/opendata.service';
import { ExternalApiClient } from '../ai/utils/external-api.client';

@Injectable()
export class FoodService {
  private geminiClient: any = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly openDataService: OpenDataService,
    private readonly externalApiClient: ExternalApiClient,
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
        // detailedAnalysis: detailedAnalysis ? JSON.stringify(detailedAnalysis) : null, // TODO: 컬럼 추가 후 활성화
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

  async analyzeFoodByText(foodName: string, diseases: string[] = []) {
    try {
      // 텍스트만으로 분석 - 질병 정보 포함
      console.log('=== 음식 분석 시작 ===');
      console.log('음식명:', foodName);
      console.log('질병 정보:', diseases);
      
      // 고정된 사용자 ID (실제로는 인증에서 가져와야 함)
      const userId = '00000000-0000-0000-0000-000000000000';
      
      // 1단계: 사용자 약물 정보 조회
      const supabase = this.supabaseService.getClient();
      const { data: medicines } = await supabase
        .from('medicine_records')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      console.log(`\n[1단계] 복용 약물: ${medicines?.length || 0}개`);
      
      // 2단계: e약은요 API로 각 약물의 상세 정보 조회
      const drugDetailsPromises = (medicines || []).map(async (medicine: any) => {
        const info = await this.externalApiClient.getMedicineInfo(medicine.name);
        return {
          name: medicine.name,
          publicData: info && info.length > 0 ? info[0] : null
        };
      });
      
      const drugDetails = await Promise.all(drugDetailsPromises);
      console.log(`\n[2단계] e약은요 API 조회 완료`);
      
      // 3단계: Gemini AI로 음식 성분 분석
      const geminiClient = await this.getGeminiClient();
      
      console.log(`\n[3단계] AI가 음식 성분 분석 중...`);
      const foodAnalysis = await geminiClient.analyzeFoodComponents(foodName, diseases);
      console.log('AI 분석 완료:', {
        주요성분: foodAnalysis.components?.slice(0, 3),
        위험요소: Object.keys(foodAnalysis.riskFactors || {}).filter(k => foodAnalysis.riskFactors[k])
      });
      
      // 4단계: AI가 음식 성분과 약물 공공데이터를 비교 분석하여 상호작용 판단
      console.log(`\n[4단계] AI가 약물-음식 상호작용 분석 중...`);
      const interactionAnalysis = await geminiClient.analyzeDrugFoodInteractions(
        foodName,
        foodAnalysis,
        drugDetails,
        diseases
      );
      
      console.log('상호작용 분석 완료:', {
        위험약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'danger').length,
        주의약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'caution').length,
        안전약물: interactionAnalysis.interactions?.filter((i: any) => i.risk_level === 'safe').length
      });
      
      // 5단계: AI가 최종 종합 분석
      console.log(`\n[5단계] AI가 최종 분석 재정리 중...`);
      const finalAnalysis = await geminiClient.generateFinalAnalysis(
        foodName,
        foodAnalysis,
        interactionAnalysis,
        diseases
      );
      
      // 6단계: 레시피 DB 참조하여 건강 레시피 재정리
      console.log(`\n[6단계] 레시피 DB 조회 중...`);
      const recipeData = await this.externalApiClient.getRecipeInfo(foodName);
      const healthyRecipes = await geminiClient.generateHealthyRecipes(
        foodName,
        finalAnalysis,
        recipeData,
        diseases
      );
      
      const score = finalAnalysis.suitabilityScore || 50;
      const analysis = finalAnalysis.briefSummary || `${foodName}에 대한 분석 결과입니다.`;
      
      // 7단계: 상세 분석 데이터 구성
      const detailedAnalysis: any = {
        pros: finalAnalysis.goodPoints || [],
        cons: finalAnalysis.badPoints || [],
        summary: finalAnalysis.summary || analysis,
        cookingTips: healthyRecipes || [],
        medicalAnalysis: {
          drug_food_interactions: interactionAnalysis.interactions || []
        },
        foodComponents: foodAnalysis.components || [],
        riskFactors: foodAnalysis.riskFactors || {},
        dataSources: ['AI 종합 분석', '식품의약품안전처 e약은요 API', 'Gemini AI 분석', '식품안전나라 조리식품 레시피DB']
      };
      
      console.log('\n[7단계] 최종 결과 정리 완료');
      console.log('점수:', score);
      console.log('약물 상호작용:', detailedAnalysis.medicalAnalysis.drug_food_interactions.length, '개');
      console.log('=== 음식 분석 완료 ===\n');

      console.log('DB 저장 데이터:', { foodName, score, analysis: analysis.substring(0, 50) + '...' });

      const result = await this.supabaseService.saveFoodAnalysis({
        foodName,
        score,
        analysis,
        diseases,
        // detailedAnalysis: detailedAnalysis ? JSON.stringify(detailedAnalysis) : null, // TODO: 컬럼 추가 후 활성화
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
