import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { OpenDataService } from '../opendata/opendata.service';

@Injectable()
export class FoodService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly openDataService: OpenDataService,
  ) {}

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
      console.log('텍스트 분석:', foodName);
      console.log('질병 정보:', diseases);
      
      let score = 70;
      let analysis = `${foodName}에 대한 분석 결과입니다.`;
      let detailedAnalysis = null;
      
      try {
        const { GeminiClient } = await import('../ai/utils/gemini.client');
        const geminiApiKey = process.env.GEMINI_API_KEY;
        
        if (geminiApiKey) {
          const geminiClient = new GeminiClient(geminiApiKey);
          
          // 간단 분석 (Flash 모델)
          const simpleAnalysis = await geminiClient.analyzeFoodSuitability(
            foodName,
            diseases,
            null
          );
          
          console.log('Gemini 분석 결과:', simpleAnalysis);
          
          // AI가 계산한 적합도 점수 직접 사용
          score = simpleAnalysis.suitabilityScore || 65;
          
          console.log(`AI가 계산한 적합도 점수: ${score}`);
          
          // 분석 텍스트
          const diseaseNote = diseases.length > 0 
            ? `\n\n선택하신 질병(${diseases.join(', ')})을 고려한 분석입니다.` 
            : '';
          analysis = `${simpleAnalysis.summary || foodName + '에 대한 분석'}${diseaseNote}`;
          
          // 상세 분석
          detailedAnalysis = {
            pros: simpleAnalysis.pros || [
              `${foodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
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
            ]
          };
          
          console.log('AI 분석 완료 - 점수:', score);
        }
      } catch (aiError) {
        console.error('AI 분석 중 오류 (기본값 사용):', aiError.message);
        
        // AI 실패 시에도 유용한 기본 분석 제공
        const diseaseNote = diseases.length > 0 
          ? `\n\n선택하신 질병(${diseases.join(', ')})을 고려하여 섭취량에 주의해주세요.` 
          : '';
        
        analysis = `${foodName}에 대한 분석입니다. 균형있게 섭취하시면 좋습니다.${diseaseNote}`;
        
        detailedAnalysis = {
          pros: [
            `${foodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
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
          summary: `${foodName}은(는) 균형있게 섭취하시면 좋습니다.`,
          cookingTips: [
            '신선한 재료를 사용하세요',
            '조리 시 염분과 당분을 적게 사용하세요',
            '채소를 많이 추가하면 더 건강해요'
          ]
        };
      }

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
