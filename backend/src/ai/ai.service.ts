import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { GeminiClient } from './utils/gemini.client';
import { ScoreCalculator } from './utils/score-calculator';
import { ExternalApiClient } from './utils/external-api.client';
import { 
  buildMedicalAnalysisPrompt, 
  MedicalAnalysisInput,
  MedicalAnalysisOutput 
} from './utils/medical-analysis-prompt';
import { AnalyzeImageDto } from './dtos/analyze-image.dto';
import { AnalyzeTextDto } from './dtos/analyze-text.dto';

@Injectable()
export class AiService {
  private geminiClient: GeminiClient;
  private scoreCalculator: ScoreCalculator;
  private externalApiClient: ExternalApiClient;

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.geminiClient = new GeminiClient(geminiApiKey);
    this.scoreCalculator = new ScoreCalculator();
    this.externalApiClient = new ExternalApiClient();
    // 캐싱을 위해 SupabaseService 주입
    this.externalApiClient.setSupabaseService(supabaseService);
  }

  /**
   * 이미지 분석 기능
   */
  async analyzeImage(dto: AnalyzeImageDto) {
    try {
      // 1. Supabase Storage URL → base64 변환
      const imageBase64 = await this.geminiClient.urlToBase64(dto.imagePath);

      // 2. Gemini Vision API로 이미지 유효성 검증 및 분류
      const visionResult = await this.geminiClient.analyzeImageForFood(
        imageBase64,
      );

      // 3. 유효하지 않은 이미지 거부
      if (!visionResult.isValid) {
        throw new HttpException(
          visionResult.rejectReason || '촬영하신 이미지가 음식이나, 약품, 건강보조제가 아닙니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const itemName = visionResult.itemName;
      const confidence = visionResult.confidence;
      const category = visionResult.category;

      // 4. 약품/건강보조제인 경우 Medicine 모듈로 처리
      if (category === 'medicine' || category === 'supplement') {
        // TODO: Medicine 모듈 연동
        console.log(`${category} detected: ${itemName}`);
        // 일단은 분석 계속 진행
      }

      // 5. [Smart Cache] 영양 데이터 및 일반 정보 확인
      let nutritionData = null;
      let cachedGeneralInfo = null;
      
      const supabase = this.supabaseService.getClient();
      const { data: cachedData } = await supabase
        .from('food_cache')
        .select('*')
        .eq('food_name', itemName)
        .single();
        
      if (cachedData) {
        console.log(`[Result01 Cache] Hit! ${itemName} 일반 정보 활용`);
        nutritionData = cachedData.nutrition_json;
        cachedGeneralInfo = cachedData.general_analysis_json;
      }

      // 6. 점수 계산
      const score = this.scoreCalculator.calculateScore(
        itemName,
        dto.diseases,
        nutritionData,
      );

      // 7. Gemini로 장단점 요약 생성 (캐시 정보 있으면 활용)
      const analysis = await this.geminiClient.analyzeFoodSuitability(
        itemName,
        dto.diseases,
        nutritionData,
        null, // publicData (기존)
        cachedGeneralInfo // [New] 캐시된 일반 정보
      );

      // 8. Supabase DB에 저장
      // const supabase = this.supabaseService.getClient(); // reusing existing client
      const { data: record, error } = await supabase
        .from('food_records')
        .insert({
          user_id: dto.userId,
          food_name: itemName,
          image_path: dto.imagePath,
          detected_label: itemName,
          confidence: confidence,
          score: score,
          summary_json: JSON.stringify({
            ...analysis,
            category,
          }),
          diseases: dto.diseases,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new HttpException(
          'DB 저장 실패',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 9. 응답 반환
      return {
        foodName: itemName,
        category,
        confidence,
        score,
        pros: analysis.pros,
        cons: analysis.cons,
        summary: analysis.summary,
        recordId: record.id,
      };
    } catch (error) {
      console.error('Image analysis error:', error);
      throw new HttpException(
        error.message || '이미지 분석 중 오류가 발생했습니다',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 텍스트/음성 기반 음식명 분석
   */
  async analyzeText(dto: AnalyzeTextDto) {
    try {
      // 1. Gemini로 음식명 추출
      const foodName = await this.geminiClient.extractFoodNameFromText(
        dto.textInput,
      );

      if (!foodName) {
        throw new HttpException(
          '텍스트에서 음식명을 추출할 수 없습니다',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. 의학적 분석 수행 (RAG 기반)
      const medicalAnalysis = await this.performMedicalAnalysis(
        foodName,
        dto.userId,
        dto.diseases,
      );

      // 3. 점수는 의학적 분석 결과에서 가져오기
      const score = medicalAnalysis.final_score;

      // 4. 분석 내용 요약
      const analysis = this.formatAnalysisSummary(medicalAnalysis);

      // 5. Supabase DB에 저장
      const supabase = this.supabaseService.getClient();
      const { data: record, error } = await supabase
        .from('food_records')
        .insert({
          user_id: dto.userId,
          food_name: foodName,
          image_path: null,
          detected_label: foodName,
          confidence: 1.0,
          score: score,
          summary_json: JSON.stringify(medicalAnalysis),
          diseases: dto.diseases,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new HttpException(
          'DB 저장 실패',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 6. 응답 반환
      return {
        foodName,
        confidence: 1.0,
        score,
        analysis,
        medicalAnalysis,
        recordId: record.id,
      };
    } catch (error) {
      console.error('Text analysis error:', error);
      throw new HttpException(
        error.message || '텍스트 분석 중 오류가 발생했습니다',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * RAG 기반 의학적 분석 수행
   */
  private async performMedicalAnalysis(
    foodName: string,
    userId: string,
    diseases: string[] = [],
  ): Promise<MedicalAnalysisOutput> {
    try {
      console.log(`\n=== 의학적 분석 시작: ${foodName} ===`);
      
      const supabase = this.supabaseService.getClient();

      // [Smart Cache] 일반 음식 정보 캐시 확인
      let generalFoodInfo = null;
      let isCached = false;
      
      const { data: cachedData } = await supabase
        .from('food_cache')
        .select('*')
        .eq('food_name', foodName)
        .single();
        
      if (cachedData) {
        console.log(`[Smart Cache] Hit! ${foodName} 정보 캐시에서 로드`);
        generalFoodInfo = cachedData;
        isCached = true;
      } else {
        console.log(`[Smart Cache] Miss. ${foodName} 정보 새로 생성 예정`);
      }

      // 1. 사용자의 복용 약물 정보 조회
      const medicines = await this.getUserMedicines(userId);
      console.log(`복용 약물: ${medicines.length}개`);

      // 2. 레시피DB에서 영양 정보 조회 (캐시가 있으면 활용)
      let nutritionData = generalFoodInfo?.nutrition_json || null;
      let recipeData = null;

      if (!nutritionData) {
        recipeData = await this.externalApiClient.getRecipeInfo(foodName);
        if (recipeData && recipeData.length > 0) {
           nutritionData = this.externalApiClient.extractNutritionFromRecipe(recipeData[0]);
           console.log(`레시피DB 영양 정보 획득: ${nutritionData?.foodName}`);
        }
      }

      // [Smart Cache] 일반 정보가 없으면 LLM으로 생성 후 저장
      if (!isCached) {
        console.log('[Smart Cache] 일반 정보 생성 중 (LLM)...');
        const generatedGeneralInfo = await this.geminiClient.generateGeneralFoodInfo(foodName, nutritionData);
        
        // 캐시 테이블에 저장
        await supabase.from('food_cache').insert({
            food_name: foodName,
            nutrition_json: nutritionData ? JSON.stringify(nutritionData) : null,
            general_analysis_json: JSON.stringify({
                general_benefit: generatedGeneralInfo.general_benefit,
                general_harm: generatedGeneralInfo.general_harm,
                nutrition_summary: generatedGeneralInfo.nutrition_summary
            }),
            cooking_tips_json: JSON.stringify(generatedGeneralInfo.cooking_tips)
        });
        
        console.log('[Smart Cache] 신규 정보 저장 완료');

        // 메모리 객체 업데이트
        generalFoodInfo = {
            general_analysis_json: {
                general_benefit: generatedGeneralInfo.general_benefit,
                general_harm: generatedGeneralInfo.general_harm,
                nutrition_summary: generatedGeneralInfo.nutrition_summary
            },
            cooking_tips_json: generatedGeneralInfo.cooking_tips
        };
      }

      // 3. 약물-음식 상호작용 정보 조회 (e약은요 API 활용)
      const drugInteractions = [];
      console.log('\n--- 약물-음식 상호작용 분석 (e약은요 API) ---');
      for (const medicine of medicines) {
        const interaction = await this.externalApiClient.analyzeMedicineFoodInteraction(
          medicine.name || medicine.medicine_name, 
          foodName,
        );
        drugInteractions.push(interaction);
        
        console.log(`\n[${medicine.name || medicine.medicine_name}]`);
        console.log(`  - 위험도: ${interaction.riskLevel}`);
        console.log(`  - 상호작용 여부: ${interaction.hasInteraction ? '있음' : '없음'}`);
        
        if (interaction.detectedPatterns && Object.keys(interaction.detectedPatterns).length > 0) {
          console.log(`  - 감지된 패턴:`);
          for (const [category, keywords] of Object.entries(interaction.detectedPatterns)) {
            console.log(`    • ${category}: ${(keywords as string[]).join(', ')}`);
          }
        }
        
        if (interaction.specificFoodInteraction?.hasMatch) {
          console.log(`  - 특정 음식 상호작용: ${foodName}과 관련 키워드 발견`);
        }
        
        if (interaction.warnings?.length > 0) console.log(`  - 경고사항 ${interaction.warnings.length}개`);
      }
      console.log('--- 상호작용 분석 완료 ---\n');

      // 4. 질병별 가이드라인 조회
      const diseaseGuidelines = [];
      for (const disease of diseases) {
        const guideline = await this.externalApiClient.getDiseaseGuideline(disease);
        diseaseGuidelines.push(guideline);
      }

      // 5. RAG 데이터 구성
      const ragData = {
        drugInteractions,
        recipeInfo: recipeData,
        nutritionFacts: nutritionData ? [nutritionData] : [],
        diseaseGuidelines,
        cachedGeneralInfo: generalFoodInfo?.general_analysis_json // 캐시 정보 주입
      };

      // 6. [Rule-based Hybrid Logic] 약물 상호작용 1차 필터링
      const preComputedInteractions = drugInteractions.map((interaction, idx) => {
        const medicineName = medicines[idx]?.name || medicines[idx]?.medicine_name || '약물';
        return {
          medicine_name: medicineName,
          risk_level: interaction.riskLevel as 'safe' | 'caution' | 'danger' | 'insufficient_data',
          detected_patterns: Object.keys(interaction.detectedPatterns || {}),
          warnings: interaction.warnings || [],
          recommendations: interaction.precautions || [],
          citation: ['식품의약품안전처 e약은요 DB'] 
        };
      });

      // 7. 의학적 분석 프롬프트 생성
      const analysisInput: MedicalAnalysisInput = {
        foodName,
        foodNutrition: nutritionData,
        medicines: medicines.map(m => ({
          name: m.medicine_name,
          dosage: m.dosage,
          frequency: m.frequency,
        })),
        diseases,
        ragData: {
            ...ragData,
            preComputedInteractions
        }
      };

      const prompt = buildMedicalAnalysisPrompt(analysisInput);

      // 8. Gemini Pro로 분석 수행 (Advice, Score 생성 위주)
      console.log('Gemini Pro 분석 요청 (Hybrid optimized)...');
      const llmResult = await this.geminiClient.generateMedicalAnalysis(prompt);

      // 9. [Hybrid Merge] 결과 병합
      const finalResult: MedicalAnalysisOutput = {
        ...llmResult,
        drug_food_interactions: preComputedInteractions.map((pre, idx) => {
            const llmCounterpart = llmResult.drug_food_interactions?.find(d => d.medicine_name === pre.medicine_name);
            return {
                ...pre,
                warnings: [...new Set([...pre.warnings, ...(llmCounterpart?.warnings || [])])],
                recommendations: [...new Set([...pre.recommendations, ...(llmCounterpart?.recommendations || [])])]
            };
        })
      };
      
      console.log(`분석 완료 - 최종 점수: ${finalResult.final_score}`);

      return finalResult;
    } catch (error) {
      console.error('Medical analysis error:', error);
      // 분석 실패 시 기본 응답 반환
      return this.getDefaultMedicalAnalysis(foodName, diseases);
    }
  }

  /**
   * 사용자의 복용 약물 정보 조회
   */
  private async getUserMedicines(userId: string): Promise<any[]> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('medicine_records')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Failed to fetch medicines:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get user medicines error:', error);
      return [];
    }
  }

  /**
   * 의학적 분석 결과를 사용자 친화적 요약으로 변환
   */
  private formatAnalysisSummary(analysis: MedicalAnalysisOutput): string {
    const parts: string[] = [];

    // 약물-음식 상호작용 (우선순위 높음)
    if (analysis.drug_food_interactions && analysis.drug_food_interactions.length > 0) {
      const dangerDrugs = analysis.drug_food_interactions.filter(d => d.risk_level === 'danger');
      const cautionDrugs = analysis.drug_food_interactions.filter(d => d.risk_level === 'caution');
      
      if (dangerDrugs.length > 0) {
        parts.push('🚨 약물 상호작용 경고:');
        dangerDrugs.forEach(drug => {
          parts.push(`\n⚠️ ${drug.medicine_name}:`);
          if (drug.warnings && drug.warnings.length > 0) {
            drug.warnings.slice(0, 2).forEach(warning => {
              parts.push(`  • ${warning}`);
            });
          }
          if (drug.recommendations && drug.recommendations.length > 0) {
            parts.push(`  → ${drug.recommendations[0]}`);
          }
        });
        parts.push('');
      }
      
      if (cautionDrugs.length > 0) {
        parts.push('⚡ 복용 중인 약물 주의사항:');
        cautionDrugs.forEach(drug => {
          parts.push(`\n• ${drug.medicine_name}:`);
          if (drug.detected_patterns && drug.detected_patterns.length > 0) {
            parts.push(`  패턴: ${drug.detected_patterns.join(', ')}`);
          }
          if (drug.recommendations && drug.recommendations.length > 0) {
            parts.push(`  → ${drug.recommendations[0]}`);
          }
        });
        parts.push('');
      }
    }

    // 전반적 상호작용 평가
    if (analysis.interaction_assessment.level === 'danger') {
      parts.push(`⚠️ 주의: ${analysis.interaction_assessment.evidence_summary}`);
    } else if (analysis.interaction_assessment.level === 'caution') {
      parts.push(`⚡ 주의사항: ${analysis.interaction_assessment.evidence_summary}`);
    }

    // 영양학적 위험
    if (analysis.nutritional_risk.risk_factors.length > 0) {
      parts.push(`\n영양학적 고려사항:\n${analysis.nutritional_risk.description}`);
    }

    // 질병별 노트
    if (analysis.disease_specific_notes.length > 0) {
      parts.push(`\n질병별 주의사항:`);
      analysis.disease_specific_notes.forEach(note => {
        parts.push(`• ${note.disease}: ${note.impact}`);
      });
    }

    // 기본 메시지
    if (parts.length === 0) {
      if (analysis.final_score >= 85) {
        parts.push('✅ 건강한 선택입니다!');
      } else if (analysis.final_score >= 70) {
        parts.push('👍 나쁘지 않은 선택이에요.');
      } else {
        parts.push('🤔 조금 주의가 필요한 음식이에요.');
      }
    }

    return parts.join('\n');
  }

  /**
   * 기본 의학적 분석 응답 (API 실패 시)
   */
  private getDefaultMedicalAnalysis(
    foodName: string,
    diseases: string[],
  ): MedicalAnalysisOutput {
    return {
      food_name: foodName,
      medicine_name: 'N/A',
      disease_list: diseases,
      interaction_assessment: {
        level: 'insufficient_data',
        evidence_summary: '충분한 데이터가 없어 정확한 분석이 어렵습니다.',
        detailed_analysis: 'RAG 데이터 수집 실패로 인해 상세 분석을 제공할 수 없습니다.',
        interaction_mechanism: '정보 없음',
        citation: [],
      },
      drug_food_interactions: [],
      nutritional_risk: {
        risk_factors: [],
        description: '영양 정보 분석 불가',
        citation: [],
      },
      disease_specific_notes: [],
      final_score: 65,
    };
  }

  /**
   * 상세 분석 생성
   */
  async getDetailedAnalysis(recordId: string) {
    try {
      // 1. food_records 조회
      const supabase = this.supabaseService.getClient();
      const { data: record, error } = await supabase
        .from('food_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error || !record) {
        throw new HttpException('기록을 찾을 수 없습니다', HttpStatus.NOT_FOUND);
      }

      // 2. 영양 데이터 가져오기 (임시로 null)
      const nutritionData = null; // TODO: Supabase nutrition DB 연동

      // 3. Gemini 1.5 Pro로 상세 분석 생성
      const detailedAnalysis =
        await this.geminiClient.generateDetailedAnalysis(
          record.food_name,
          record.diseases || [],
          nutritionData,
        );

      // 4. 상세 분석 결과를 DB에 업데이트 (선택사항)
      await supabase
        .from('food_records')
        .update({
          detailed_analysis_json: JSON.stringify(detailedAnalysis),
        })
        .eq('id', recordId);

      return detailedAnalysis;
    } catch (error) {
      console.error('Detailed analysis error:', error);
      throw new HttpException(
        error.message || '상세 분석 중 오류가 발생했습니다',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
