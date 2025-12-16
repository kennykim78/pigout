import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ExternalApiClient } from '../ai/utils/external-api.client';

@Injectable()
export class MedicineService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly externalApiClient: ExternalApiClient,
  ) {
    // 의약품 검색 캐싱을 위해 SupabaseService 주입
    this.externalApiClient.setSupabaseService(supabaseService);
  }

  /**
   * 약품명, 효능(질병), 제조사로 검색 (e약은요 API 사용)
   * API 결과 없을 때 AI가 제품 유형 판단 후 올바른 탭 안내
   */
  async searchMedicine(keyword: string, numOfRows: number = 200) {
    try {
      console.log(`[약품 검색] 키워드: ${keyword}, 요청 수: ${numOfRows}`);
      
      // 최대값 200으로 통일 (식약처 API 안정성 및 성능 고려)
      const apiLimit = Math.min(Math.max(numOfRows, 50), 200);
      
      console.log(`[약품 검색] API 호출 제한: ${apiLimit}건 (최대 200)`);
      
      // 1️⃣ 약품명으로 검색 (1차 - 우선)
      let nameResults = await this.externalApiClient.getMedicineInfo(keyword, apiLimit);
      
      console.log(`[약품 검색-디버그] nameResults 개수: ${nameResults.length}`);
      if (nameResults.length > 0) {
        console.log(`[약품 검색-디버그] 첫 번째 결과 샘플:`, {
          itemSeq: nameResults[0].itemSeq,
          itemName: nameResults[0].itemName,
          _isAIGenerated: nameResults[0]._isAIGenerated,
          _source: nameResults[0]._source,
        });
      }
      
      // 실제 데이터인지 확인 (AI 생성 데이터 제외)
      // _isAIGenerated가 없으면 실제 데이터로 간주
      const hasRealNameResults = nameResults.some((item: any) => 
        item._isAIGenerated !== true && item.itemSeq && !item.itemSeq.startsWith('AI_')
      );
      
      console.log(`[약품 검색-디버그] hasRealNameResults: ${hasRealNameResults}`);
      
      let efficacyResults: any[] = [];
      let manufacturerResults: any[] = [];
      
      // 2️⃣ 약품명 검색 결과가 없을 때만 효능/제조사 검색 (API 절약)
      if (!hasRealNameResults) {
        console.log(`[약품 검색] 약품명 결과 없음 → 효능/제조사 검색 시작`);
        
        efficacyResults = await this.externalApiClient.searchMedicineByEfficacy(keyword, apiLimit);
        manufacturerResults = await this.externalApiClient.searchMedicineByManufacturer(keyword, apiLimit);
      } else {
        console.log(`[약품 검색] 약품명 성공 (${nameResults.length}건) → 효능/제조사 스킵 ⏭️ (API 절약)`);
      }
      
      console.log(`[약품 검색] 결과 - 약품명: ${nameResults.length}건, 효능: ${efficacyResults.length}건, 제조사: ${manufacturerResults.length}건`);
      
      // 3️⃣ 결과 병합 및 중복 제거 (itemSeq 기준)
      const combinedResults = [...nameResults, ...efficacyResults, ...manufacturerResults];
      const uniqueResults = Array.from(
        new Map(combinedResults.map(item => [item.itemSeq, item])).values()
      );
      
      console.log(`[약품 검색] 중복제거 후: ${uniqueResults.length}건`);
      
      // 🔒 4️⃣ 최종 필터링: AI 생성 데이터만 제거 (실제 데이터만 반환)
      // 두 가지 방식으로 AI 데이터 감지:
      // 1. _isAIGenerated 플래그 (명시적 마킹)
      // 2. itemSeq 패턴 (AI_MED_*, AI_HF_*, AI_*) - 정규식 체크
      const isAIGenerated = (item: any) => {
        if (item._isAIGenerated === true) return true;  // 명시적 플래그
        if (typeof item.itemSeq === 'string') {
          return /^AI_/.test(item.itemSeq);  // itemSeq가 "AI_"로 시작하면 AI 데이터
        }
        return false;
      };

      const realResults = uniqueResults.filter((item: any) => !isAIGenerated(item));
      
      // 📊 필터링 상세 로그
      const aiCount = uniqueResults.length - realResults.length;
      if (aiCount > 0) {
        console.log(`[약품 검색] AI 데이터 필터링: ${aiCount}건 제거`);
      }
      console.log(`[약품 검색] AI 데이터 필터링 후: ${realResults.length}건 (실제 약품)`);
      
      // 💡 결과가 200개 초과 시 상위 200개만 반환
      let finalResults = realResults;
      if (realResults.length > 200) {
        console.log(`[약품 검색] ⚠️ 검색 결과 ${realResults.length}건 → 상위 200개만 반환`);
        finalResults = realResults.slice(0, 200);
      }
      
      if (!finalResults || finalResults.length === 0) {
        console.log(`[약품 검색] ⚠️ 실제 약품 검색 결과 없음 - 빈 배열 반환`);
        return [];
      }

      // ✅ 검색 시에는 기본 정보만 반환 (상세 정보는 등록 시점에 조회)
      const results = finalResults.map((item: any) => ({
        itemSeq: item.itemSeq,
        itemName: item.itemName,
        entpName: item.entpName,
        // 상세 정보는 등록 시점에 API로 조회
      }));

      // 🆕 각 약품을 공용 캐시에 저장 (itemSeq+entpName 단위)
      for (const result of results) {
        // API 전체 결과를 캐시에 저장
        const fullMedicineData = finalResults.find(
          (item: any) => item.itemSeq === result.itemSeq && item.entpName === result.entpName
        );
        
        if (fullMedicineData) {
          await this.supabaseService.saveMedicineDetailCache(
            result.itemSeq,
            result.entpName,
            fullMedicineData,
            '의약품(e약은요)',
          );
        }
      }

      console.log(`[약품 검색] ${results.length}건 검색됨, 캐시 저장 완료`);
      return results;
    } catch (error) {
      console.error('[약품 검색] 오류:', error.message);
      throw error;
    }
  }

  /**
   * 건강기능식품 전용 검색 (HtfsInfoService03 API 사용)
   * 의약품 검색과 분리하여 건강기능식품만 검색
   * API 결과가 없으면 AI가 제품 유형 판단 후 올바른 탭 안내 또는 정보 생성
   */
  async searchHealthFood(keyword: string, numOfRows: number = 200) {
    try {
      console.log(`[건강기능식품 검색] 키워드: ${keyword}, 요청 수: ${numOfRows}`);
      
      // 최대값 200으로 통일 (식약처 API 안정성 및 성능 고려)
      const apiLimit = Math.min(Math.max(numOfRows, 50), 200);
      
      // 건강기능식품 API 검색
      let results = await this.externalApiClient.searchHealthFunctionalFood(keyword, apiLimit);
      
      // 🆕 AI 생성 데이터 필터링
      const hasRealResults = results && results.some((item: any) => 
        item.itemSeq && !item.itemSeq.startsWith('AI_HF_')
      );
      
      if (!hasRealResults && results && results.length > 0) {
        console.log(`[건강기능식품 검색] AI 생성 데이터만 발견 - 제거`);
        results = [];
      }
      
      if (results && results.length > 0) {
        // 💡 결과가 200개 초과 시 상위 200개만 반환
        let limitedResults = results;
        if (results.length > 200) {
          console.log(`[건강기능식품 검색] ⚠️ 검색 결과 ${results.length}건 → 상위 200개만 반환`);
          limitedResults = results.slice(0, 200);
        }
        
        // ✅ 검색 시에는 기본 정보만 반환 (상세 정보는 등록 시점에 조회)
        const formattedResults = limitedResults.map((item: any) => ({
          itemSeq: item.itemSeq,
          itemName: item.itemName,
          entpName: item.entpName,
          _isHealthFunctionalFood: true,
          _rawMaterial: item._rawMaterial || '',
        }));
        
        // 🆕 각 건강기능식품을 공용 캐시에 저장
        for (const result of formattedResults) {
          const fullData = results.find(
            (item: any) => item.itemSeq === result.itemSeq && item.entpName === result.entpName
          );
          
          if (fullData) {
            await this.supabaseService.saveMedicineDetailCache(
              result.itemSeq,
              result.entpName,
              fullData,
              '건강기능식품',
            );
          }
        }
        
        console.log(`[건강기능식품 검색] ✅ ${formattedResults.length}건 검색됨, 캐시 저장 완료`);
        return formattedResults;
      }
      
      // 🆕 먼저 AI에게 제품 유형 판단 요청 (의약품 검색 전에!)
      const productType = await this.externalApiClient.classifyProductType(keyword);
      console.log(`[건강기능식품 검색] AI 제품 유형 판단: ${productType}`);
      
      // 건강기능식품으로 판단된 경우 - AI 생성 결과 반환 (의약품 탭 안내 안함)
      if (productType === 'healthFood') {
        console.log(`[건강기능식품 검색] AI가 건강기능식품으로 판단 - AI 정보 생성`);
        const aiResults = await this.externalApiClient.generateAIHealthFoodInfo(keyword, 10);
        
        if (aiResults && aiResults.length > 0) {
          console.log(`[건강기능식품 검색] ✅ AI 생성 ${aiResults.length}건`);
          return aiResults.map((item: any) => ({
            itemSeq: item.itemSeq,
            itemName: item.itemName,
            entpName: item.entpName,
            efcyQesitm: item.efcyQesitm,
            useMethodQesitm: item.useMethodQesitm,
            atpnWarnQesitm: item.atpnWarnQesitm,
            atpnQesitm: item.atpnQesitm,
            intrcQesitm: item.intrcQesitm,
            seQesitm: item.seQesitm,
            depositMethodQesitm: item.depositMethodQesitm,
            _isHealthFunctionalFood: true,
            _isAIGenerated: true,
            _rawMaterial: item._rawMaterial || '',
          }));
        }
      }
      
      // AI가 의약품으로 판단한 경우 - 의약품 API에서 "실제" 데이터만 확인
      if (productType === 'medicine') {
        console.log(`[건강기능식품 검색] API 결과 없음 - 의약품 검색 시도`);
        let medicineResults = await this.externalApiClient.getMedicineInfo(keyword, 5);
        
        // 의약품 검색에서 AI 데이터 제거 (itemSeq가 AI_로 시작하거나 _isAIGenerated 플래그)
        const realMedicineResults = (medicineResults || []).filter((item: any) => 
          item.itemSeq && 
          !item.itemSeq.startsWith('AI_') && 
          !item._isAIGenerated
        );
        
        if (realMedicineResults.length > 0) {
          // 실제 의약품에서 발견됨 - 탭 이동 안내
          console.log(`[건강기능식품 검색] ✅ 의약품 탭에서 ${realMedicineResults.length}건 발견 - 탭 이동 안내`);
          return {
            results: [],
            suggestion: {
              type: 'wrongTab',
              correctTab: 'add',
              message: `"${keyword}"은(는) 의약품입니다. 의약품 탭에서 검색해주세요.`,
              foundCount: realMedicineResults.length,
            }
          };
        }
      }
      
      // 알 수 없는 유형이거나 AI 결과만 있는 경우 - 빈 결과 반환
      console.log(`[건강기능식품 검색] 결과 없음`);
      return [];
    } catch (error) {
      console.error('[건강기능식품 검색] 오류:', error.message);
      throw error;
    }
  }

  /**
   * 이미지에서 약품 정보 추출 (AI 분석)
   * 약 봉지, 처방전, 알약 등 촬영하여 약품명 인식
   * 다수의 약품이 포함된 경우 모두 추출하여 반환
   */
  async analyzeMedicineImage(imageBase64: string, mimeType: string = 'image/jpeg') {
    try {
      console.log(`[약품 이미지 분석] 시작`);

      // Gemini API로 이미지 분석
      const { GeminiClient } = await import('../ai/utils/gemini.client');
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
      }

      const geminiClient = new GeminiClient(geminiApiKey);
      const analysisResult = await geminiClient.analyzeMedicineImage(imageBase64);

      console.log(`[약품 이미지 분석] AI 분석 결과:`, analysisResult.success ? `${analysisResult.totalCount}개 약품 감지` : '분석 실패');

      if (!analysisResult.success || analysisResult.medicines.length === 0) {
        return {
          success: false,
          message: analysisResult.message || '이미지에서 약품을 인식할 수 없습니다. 약품명이 잘 보이도록 다시 촬영해주세요.',
          detectedMedicines: [],
          verifiedMedicines: [],
        };
      }

      const detectedMedicines = analysisResult.medicines;

      // 🆕 감지된 약품들에 대해 공공데이터 API로 검증만 수행 (상세정보는 제외)
      // 상세정보(효능, 용법 등)는 사용자가 등록 시점에 조회
      const verifiedMedicines = [];

      for (const medicine of detectedMedicines) {
        console.log(`[약품 이미지 분석] 검증 중: ${medicine.name}`);
        
        // e약은요 API로 약품 검색 - 약품명/제조사만 가져오고 상세정보는 제외
        const apiResults = await this.externalApiClient.getMedicineInfo(medicine.name, 3);
        
        if (apiResults && apiResults.length > 0) {
          // API에서 찾은 결과 - 약품명/제조사만 포함 (효능/용법은 나중에 등록 시 조회)
          const matched = apiResults[0];
          verifiedMedicines.push({
            detectedName: medicine.name,
            confidence: medicine.confidence / 100, // 0-100 → 0-1
            type: medicine.shape,
            verified: true,
            apiMatch: {
              itemSeq: matched.itemSeq,
              itemName: matched.itemName,
              entpName: matched.entpName,
              // 🆕 상세 정보는 제외 (등록 시 조회)
              // efcyQesitm, useMethodQesitm, atpnQesitm, intrcQesitm, seQesitm 제외
            },
            shape: medicine.shape,
            color: medicine.color,
            imprint: medicine.imprint,
          });
        } else {
          // API에서 못 찾은 경우 - 낱알정보로 시도
          const pillResults = await this.externalApiClient.getPillIdentificationInfo({
            itemName: medicine.name,
            numOfRows: 3,
          });
          
          if (pillResults && pillResults.length > 0) {
            const matched = pillResults[0];
            verifiedMedicines.push({
              detectedName: medicine.name,
              confidence: medicine.confidence / 100,
              type: medicine.shape,
              verified: true,
              apiMatch: {
                itemSeq: matched.ITEM_SEQ,
                itemName: matched.ITEM_NAME,
                entpName: matched.ENTP_NAME,
                // 🆕 상세 정보는 제외 (등록 시 조회)
              },
              shape: medicine.shape || matched.DRUG_SHAPE,
              color: medicine.color || matched.COLOR_CLASS1,
              imprint: medicine.imprint || matched.PRINT_FRONT,
            });
          } else {
            // 검증 실패 - AI 감지 정보만 반환
            verifiedMedicines.push({
              detectedName: medicine.name,
              confidence: medicine.confidence / 100,
              type: medicine.shape,
              verified: false,
              apiMatch: null,
              shape: medicine.shape,
              color: medicine.color,
              imprint: medicine.imprint,
              manufacturer: medicine.manufacturer,
            });
          }
        }
      }

      console.log(`[약품 이미지 분석] 완료 - 검증됨: ${verifiedMedicines.filter(m => m.verified).length}건`);

      return {
        success: true,
        message: `${detectedMedicines.length}개의 약품이 감지되었습니다.`,
        detectedMedicines: detectedMedicines,
        verifiedMedicines: verifiedMedicines,
        imageType: analysisResult.imageType,
        rawText: analysisResult.rawText,
        summary: {
          total: detectedMedicines.length,
          verified: verifiedMedicines.filter(m => m.verified).length,
          unverified: verifiedMedicines.filter(m => !m.verified).length,
        },
      };
    } catch (error) {
      console.error('[약품 이미지 분석] 오류:', error.message);
      throw error;
    }
  }

  /**
   * 검색 결과에서 약 직접 등록
   */
  async addMedicineFromSearch(
    userId: string,
    medicineData: any,
  ) {
    const client = this.supabaseService.getClient();

    const itemName = medicineData.itemName || medicineData.name;
    const entpName = medicineData.entpName || medicineData.manufacturer;
    const itemSeq = medicineData.itemSeq;

    console.log(`[약 등록] ${itemName} (${entpName}), itemSeq: ${itemSeq}`);

    // 🔥 등록 시점에 상세정보 조회 (검색 시에는 기본 정보만 받았으므로 항상 조회)
    let detailedData = { ...medicineData };
    
    // ✅ 검색 결과에 상세 정보가 없으면 무조건 API 조회
    const needsDetailFetch = !detailedData.efcyQesitm || 
                            !detailedData.useMethodQesitm ||
                            detailedData.efcyQesitm.length < 50;

    // 문자열 'null'을 실제 null로 정규화
    const normalizeDetailFields = () => {
      const normalize = (v: any) => {
        if (v === undefined || v === null) return null;
        if (typeof v === 'string' && v.trim().toLowerCase() === 'null') return null;
        return v;
      };

      detailedData.efcyQesitm = normalize(detailedData.efcyQesitm);
      detailedData.useMethodQesitm = normalize(detailedData.useMethodQesitm);
      detailedData.atpnWarnQesitm = normalize(detailedData.atpnWarnQesitm);
      detailedData.atpnQesitm = normalize(detailedData.atpnQesitm);
      detailedData.intrcQesitm = normalize(detailedData.intrcQesitm);
      detailedData.seQesitm = normalize(detailedData.seQesitm);
      detailedData.depositMethodQesitm = normalize(detailedData.depositMethodQesitm);
    };

    normalizeDetailFields();

    if (needsDetailFetch && itemSeq) {
      console.log(`[약 등록] 상세정보 조회 시작 → itemSeq: ${itemSeq}`);
      try {
        // 건강기능식품인 경우
        if (detailedData._isHealthFunctionalFood) {
          const healthFoodDetail = await this.externalApiClient.getHealthFoodDetail(itemSeq);
          if (healthFoodDetail) {
            detailedData.efcyQesitm = healthFoodDetail.efcyQesitm || detailedData.efcyQesitm;
            detailedData.useMethodQesitm = healthFoodDetail.useMethodQesitm || detailedData.useMethodQesitm;
            detailedData.atpnWarnQesitm = healthFoodDetail.atpnWarnQesitm || detailedData.atpnWarnQesitm;
            detailedData.atpnQesitm = healthFoodDetail.atpnQesitm || detailedData.atpnQesitm;
            detailedData.intrcQesitm = healthFoodDetail.intrcQesitm || detailedData.intrcQesitm;
            detailedData.seQesitm = healthFoodDetail.seQesitm || detailedData.seQesitm;
            detailedData.depositMethodQesitm = healthFoodDetail.depositMethodQesitm || detailedData.depositMethodQesitm;
            
            console.log(`✅ [약 등록] 건강기능식품 상세정보 조회 완료`);
          }
        } else {
          // 의약품인 경우
          // 1️⃣ e약은요 API 상세정보 조회 시도
          const eDrugDetail = await this.externalApiClient.getMedicineInfo(itemName, 1);
          if (eDrugDetail && eDrugDetail.length > 0 && eDrugDetail[0].itemSeq === itemSeq) {
            const detail = eDrugDetail[0];
            if (detail.efcyQesitm) detailedData.efcyQesitm = detail.efcyQesitm;
            if (detail.useMethodQesitm) detailedData.useMethodQesitm = detail.useMethodQesitm;
            if (detail.atpnWarnQesitm) detailedData.atpnWarnQesitm = detail.atpnWarnQesitm;
            if (detail.atpnQesitm) detailedData.atpnQesitm = detail.atpnQesitm;
            if (detail.intrcQesitm) detailedData.intrcQesitm = detail.intrcQesitm;
            if (detail.seQesitm) detailedData.seQesitm = detail.seQesitm;
            if (detail.depositMethodQesitm) detailedData.depositMethodQesitm = detail.depositMethodQesitm;
            
            console.log(`✅ [약 등록] e약은요 상세정보 조회 완료`);
          } else {
            // 2️⃣ 허가정보 API 상세정보 조회
            const detailApiData = await this.externalApiClient.getDrugApprovalDetail(itemSeq);
            if (detailApiData) {
              detailedData.efcyQesitm = detailApiData.EE_DOC_DATA || detailedData.efcyQesitm;
              detailedData.useMethodQesitm = detailApiData.UD_DOC_DATA || detailedData.useMethodQesitm;
              detailedData.atpnWarnQesitm = detailApiData.NB_DOC_DATA || detailedData.atpnWarnQesitm;
              detailedData.seQesitm = detailApiData.SE_DOC_DATA || detailedData.seQesitm;
              detailedData.depositMethodQesitm = detailApiData.DEPOSIT_METHOD_QESITM || detailedData.depositMethodQesitm;
              
              console.log(`✅ [약 등록] 허가정보 상세정보 조회 완료`);
            }
          }
        }
        
        console.log(`✅ [약 등록] 최종 상세정보:`, {
          efcyQesitm: detailedData.efcyQesitm ? `있음(${detailedData.efcyQesitm.length}자)` : 'null',
          useMethodQesitm: detailedData.useMethodQesitm ? `있음(${detailedData.useMethodQesitm.length}자)` : 'null',
        });
      } catch (detailError) {
        console.warn(`⚠️ [약 등록] 상세정보 조회 실패:`, detailError.message);
      }
    } else {
      // 상세 조회를 하지 않은 경우에도 정규화 상태 로그
      console.log(`ℹ️ [약 등록] 상세조회 생략 - 캐시/검색 데이터 사용`, {
        efcyQesitm: detailedData.efcyQesitm ? `있음(${detailedData.efcyQesitm.length}자)` : 'null',
        useMethodQesitm: detailedData.useMethodQesitm ? `있음(${detailedData.useMethodQesitm.length}자)` : 'null',
      });
    }

    // 🆕 AI를 통한 약물 성분 추출 (분석 컴포넌트에서 사용)
    let componentData = { mainIngredient: itemName, drugClass: '알 수 없음', components: [] };
    try {
      const { GeminiClient } = await import('../ai/utils/gemini.client');
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        const geminiClient = new GeminiClient(geminiApiKey);
        componentData = await geminiClient.extractMedicineComponents(
          itemName,
          detailedData.efcyQesitm,
          entpName
        );
        console.log(`✅ [약 등록] AI 성분 추출 완료:`, {
          mainIngredient: componentData.mainIngredient,
          drugClass: componentData.drugClass,
          componentsCount: componentData.components.length,
        });
      }
    } catch (componentError) {
      console.warn(`⚠️ [약 등록] AI 성분 추출 실패:`, componentError.message);
    }

    // 🧠 등록 시점 AI 약품 정보 분석 (공공데이터를 보강하여 캐시)
    let aiAnalyzedInfo: any = null;
    let aiScheduleInfo: any = null;
    let enhancedInfo: any = null;
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        const { GeminiClient } = await import('../ai/utils/gemini.client');
        const geminiClient = new GeminiClient(geminiApiKey);
        
        // 약품 정보 분석
        aiAnalyzedInfo = await geminiClient.analyzeMedicineInfo(itemName, detailedData);
        console.log(`✅ [약 등록] AI 약품 정보 분석 완료 (요약 저장)`);
        
        // 복용 시간대 분석 (용법용량 정보가 없거나 불완전한 경우)
        if (!detailedData.useMethodQesitm || detailedData.useMethodQesitm.length < 10) {
          aiScheduleInfo = await geminiClient.analyzeMedicineSchedule(itemName, detailedData);
          console.log(`✅ [약 등록] AI 복용 시간대 분석 완료:`, aiScheduleInfo);
        }

        // 🆕 토큰 절약을 위한 강화 정보 생성 (음식 상호작용, 카테고리, 핵심 주의사항)
        enhancedInfo = await geminiClient.generateMedicineEnhancedInfo({
          itemName,
          efcyQesitm: detailedData.efcyQesitm,
          useMethodQesitm: detailedData.useMethodQesitm,
          atpnWarnQesitm: detailedData.atpnWarnQesitm,
          atpnQesitm: detailedData.atpnQesitm,
          intrcQesitm: detailedData.intrcQesitm,
          seQesitm: detailedData.seQesitm,
          depositMethodQesitm: detailedData.depositMethodQesitm,
          aiAnalyzedInfo,
        });
        console.log(`✅ [약 등록] 토큰 절약 강화 정보 생성 완료 - 카테고리: ${enhancedInfo.category}`);
      }
    } catch (aiErr) {
      console.warn('⚠️ [약 등록] AI 분석 실패:', aiErr.message);
    }

    // AI 분석 결과 기반으로 dosage, frequency 설정
    let dosage = medicineData.dosage || null;
    let frequency = medicineData.frequency || null;
    
    if (aiScheduleInfo) {
      // AI가 분석한 복용 시간대 정보 활용
      dosage = aiScheduleInfo.dosagePerTime;
      frequency = `1일 ${aiScheduleInfo.timesPerDay}회`;
      console.log(`✅ [약 등록] AI 기반 복용 정보 설정: ${dosage}, ${frequency}`);
    }

    // DB 저장 (기본 필드만, API 상세 정보와 AI 분석은 qr_code_data JSON에 저장)
    const recordData = {
      user_id: userId,
      name: itemName,
      drug_class: entpName,
      dosage: dosage,
      frequency: frequency,
      // 모든 API 상세 정보를 qr_code_data JSON에 포함 (🆕 성분 정보 + 복용 시간대 + 강화 정보 추가)
      qr_code_data: JSON.stringify({
        itemSeq: itemSeq,
        itemName: itemName,
        entpName: entpName,
        efcyQesitm: detailedData.efcyQesitm || null,
        useMethodQesitm: detailedData.useMethodQesitm || null,
        atpnWarnQesitm: detailedData.atpnWarnQesitm || null,
        atpnQesitm: detailedData.atpnQesitm || null,
        intrcQesitm: detailedData.intrcQesitm || null,
        seQesitm: detailedData.seQesitm || null,
        depositMethodQesitm: detailedData.depositMethodQesitm || null,
        // 🆕 AI 추출 성분 정보
        mainIngredient: componentData.mainIngredient,
        drugClass: componentData.drugClass,
        components: componentData.components,
        // 🆕 AI 약품 상세 분석 캐시
        aiAnalyzedInfo,
        // 🆕 AI 복용 시간대 분석 캐시
        aiScheduleInfo,
        // 🆕 토큰 절약 강화 정보 (음식 상호작용, 카테고리, 핵심 주의사항)
        enhancedInfo,
      }),
      is_active: true,
    };

    const { data, error } = await client
      .from('medicine_records')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('[약 등록 실패]:', error);
      throw error;
    }

    // 🆕 약품 정보를 공용 캐시에 저장 (상세정보 포함)
    if (itemSeq && entpName) {
      try {
        await this.supabaseService.saveMedicineDetailCache(
          itemSeq,
          entpName,
          detailedData,
          '의약품(등록시조회)',
        );
      } catch (err) {
        console.warn('[약 캐시 저장 오류]:', err.message);
      }
    }

    console.log(`[약 등록 완료] ID: ${data.id}`);
    return {
      success: true,
      medicineRecord: data,
    };
  }

  /**
   * 사용자의 복용 약 목록 조회
   * DB의 snake_case 필드를 camelCase로 변환하여 반환
   */
  async getMyMedicines(userId: string, activeOnly: boolean = true) {
    let query = this.supabaseService
      .getClient()
      .from('medicine_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    // DB 필드(snake_case)를 프론트엔드 필드(camelCase)로 변환
    // qr_code_data JSON과 DB 직접 필드 모두 확인
    return data.map((record, index) => {
      const sanitize = (value: any) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim().toLowerCase() === 'null') return null;
        return value;
      };

      let qrData: any = {};
      try {
        qrData = record.qr_code_data ? JSON.parse(record.qr_code_data) : {};
      } catch (err: any) {
        console.warn(`[getMyMedicines] qr_code_data 파싱 실패 (ID: ${record.id}):`, err.message);
      }

      // AI 보완 정보
      const aiInfo = qrData.aiAnalyzedInfo || {};
      const aiScheduleInfo = qrData.aiScheduleInfo || {};

      // 필드 정규화 (문자열 'null' 제거 및 AI 보완 정보 적용)
      const efcyQesitm = sanitize(record.efcy_qesitm) || sanitize(qrData.efcyQesitm) || sanitize(aiInfo.efficacy);
      const useMethodQesitm =
        sanitize(record.use_method_qesitm) ||
        sanitize(qrData.useMethodQesitm) ||
        sanitize(aiScheduleInfo.recommendation) ||
        sanitize(aiInfo.usage);
      const atpnWarnQesitm = sanitize(record.atpn_warn_qesitm) || sanitize(qrData.atpnWarnQesitm) || sanitize(aiInfo.precautions);
      const atpnQesitm = sanitize(qrData.atpnQesitm) || sanitize(aiInfo.precautions);
      const intrcQesitm = sanitize(record.intrc_qesitm) || sanitize(qrData.intrcQesitm) || sanitize(aiInfo.interactions);
      const seQesitm = sanitize(record.se_qesitm) || sanitize(qrData.seQesitm) || sanitize(aiInfo.sideEffects);
      const depositMethodQesitm = sanitize(record.deposit_method_qesitm) || sanitize(qrData.depositMethodQesitm) || sanitize(aiInfo.storageMethod);

      // 복용량/횟수 보완 (AI 분석 결과 우선)
      const dosage = sanitize(record.dosage) || sanitize(aiScheduleInfo.dosagePerTime) || sanitize(qrData.dosage);
      const frequency = sanitize(record.frequency) ||
        (aiScheduleInfo.timesPerDay ? `1일 ${aiScheduleInfo.timesPerDay}회` : null) ||
        sanitize(qrData.frequency);

      const result = {
        id: record.id,
        userId: record.user_id,
        name: record.name,
        itemName: record.item_name || qrData.itemName || record.name,
        drugClass: record.drug_class,
        entpName: record.entp_name || qrData.entpName || record.drug_class,
        dosage,
        frequency,
        // DB 직접 필드 우선, qr_code_data는 대체
        itemSeq: record.item_seq || qrData.itemSeq,
        efcyQesitm,
        useMethodQesitm,
        atpnWarnQesitm,
        atpnQesitm,
        intrcQesitm,
        seQesitm,
        depositMethodQesitm,
        qrCodeData: record.qr_code_data,
        isActive: record.is_active,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        // 🆕 AI 추출 성분 정보 (분석 컴포넌트용)
        mainIngredient: qrData.mainIngredient || null,
        medicineClass: qrData.drugClass || null,
        components: qrData.components || [],
        aiScheduleInfo,
        aiAnalyzedInfo: aiInfo,
        // 차트용 추가 메타데이터
        _hasDetailedInfo: !!(
          efcyQesitm || seQesitm || intrcQesitm
        ),
        _hasComponents: !!(qrData.components && qrData.components.length > 0),
      };

      // 첫 번째 약품의 상세 정보 로그
      if (index === 0) {
        console.log(`[getMyMedicines] 첫 번째 약품 (${result.itemName}):`, {
          'DB efcy_qesitm': record.efcy_qesitm ? `있음(${record.efcy_qesitm.length}자)` : 'null',
          'DB use_method_qesitm': record.use_method_qesitm ? `있음(${record.use_method_qesitm.length}자)` : 'null',
          'DB atpn_warn_qesitm': record.atpn_warn_qesitm ? `있음(${record.atpn_warn_qesitm.length}자)` : 'null',
          '최종 efcyQesitm': result.efcyQesitm ? `있음(${result.efcyQesitm.length}자)` : 'null',
          '최종 useMethodQesitm': result.useMethodQesitm ? `있음(${result.useMethodQesitm.length}자)` : 'null',
          '최종 atpnWarnQesitm': result.atpnWarnQesitm ? `있음(${result.atpnWarnQesitm.length}자)` : 'null',
          '🆕 mainIngredient': result.mainIngredient || 'null',
          '🆕 components 개수': result.components?.length || 0,
        });
      }

      return result;
    });
  }

  /**
   * 약-음식 상호작용 분석
   */
  async analyzeInteraction(medicineIds: string[], foodName: string) {
    const client = this.supabaseService.getClient();

    // 약품 정보 조회
    const { data: medicines, error } = await client
      .from('medicine_list')
      .select('name, food_interactions, interactions')
      .in('id', medicineIds);

    if (error) throw error;

    const interactions = [];

    for (const medicine of medicines) {
      // 음식 상호작용 체크
      const foodInteractions = medicine.food_interactions || [];
      const hasInteraction = foodInteractions.some((food) =>
        foodName.includes(food) || food.includes(foodName),
      );

      if (hasInteraction) {
        interactions.push({
          medicine: medicine.name,
          riskLevel: 'warning',
          description: `${medicine.name}은(는) ${foodName}와(과) 상호작용 가능성이 있습니다.`,
          affectedFoods: foodInteractions,
        });
      }
    }

    return {
      foodName,
      medicineCount: medicines.length,
      interactions,
      hasRisk: interactions.length > 0,
    };
  }

  /**
   * 약 복용 기록 업데이트 (비활성화, 복용 시간대 수정 등)
   */
  async updateMedicineRecord(userId: string, recordId: string, updates: any) {
    // timeSlots 정보가 있으면 qr_code_data에 저장
    if (updates.timeSlots) {
      // 기존 레코드 조회
      const { data: existingRecord, error: fetchError } = await this.supabaseService
        .getClient()
        .from('medicine_records')
        .select('qr_code_data')
        .eq('id', recordId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      // qr_code_data 파싱 및 업데이트
      let qrData = {};
      try {
        qrData = existingRecord.qr_code_data ? JSON.parse(existingRecord.qr_code_data) : {};
      } catch (err) {
        console.warn(`[updateMedicineRecord] qr_code_data 파싱 실패:`, err.message);
      }

      // aiScheduleInfo 업데이트
      qrData['aiScheduleInfo'] = {
        timeSlots: updates.timeSlots, // ['morning', 'evening'] 형식
        timesPerDay: updates.timeSlots.length,
        dosagePerTime: updates.dosage || qrData['aiScheduleInfo']?.dosagePerTime || '1정',
        recommendation: `사용자가 설정한 복용 시간대: ${updates.timeSlots.map(s => {
          if (s === 'morning') return '아침';
          if (s === 'afternoon') return '점심';
          if (s === 'evening') return '저녁';
          return s;
        }).join(', ')}`,
        userModified: true, // 사용자가 직접 수정한 경우
      };

      // dosage, frequency도 qr_code_data에 반영
      updates.qr_code_data = JSON.stringify(qrData);
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('medicine_records')
      .update(updates)
      .eq('id', recordId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ [약 복용 시간 업데이트] ID: ${recordId}, 시간대: ${updates.timeSlots?.join(', ')}`);
    return data;
  }

  /**
   * 약 복용 기록 삭제
   */
  async deleteMedicineRecord(userId: string, recordId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('medicine_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  }

  /**
   * 복용 중인 모든 약물의 상관관계 종합 분석
   */
  async analyzeAllMedicineInteractions(userId: string, userProfile?: { age?: number; gender?: string }) {
    const client = this.supabaseService.getClient();

    // 1단계: 복용 중인 모든 약물 조회
    const { data: medicines } = await client
      .from('medicine_records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!medicines || medicines.length === 0) {
      throw new NotFoundException('복용 중인 약이 없습니다.');
    }

    console.log(`\n[약물 상관관계 분석] 복용 중인 약물: ${medicines.length}개`);
    if (userProfile && userProfile.age && userProfile.gender) {
      console.log(`[약물 상관관계 분석] 환자 정보: ${userProfile.age}세, ${userProfile.gender === 'male' ? '남성' : '여성'}`);
    }

    // 2단계: 각 약물의 공공데이터 조회 (캐시 우선)
    const drugDetailsPromises = medicines.map(async (medicine: any) => {
      // 약 이름으로 API에서 itemSeq 조회 (또는 qr_code_data에서 파싱)
      let itemSeq: string | null = null;
      let entpName: string | null = null;
      
      try {
        const qrData = medicine.qr_code_data ? JSON.parse(medicine.qr_code_data) : {};
        itemSeq = qrData.itemSeq || null;
        entpName = qrData.manufacturer || medicine.drug_class || null;
      } catch (e) {
        // JSON 파싱 실패 시 무시
      }

      // 🆕 캐시에서 우선 조회
      let cachedData = null;
      if (itemSeq && entpName) {
        cachedData = await this.supabaseService.getMedicineDetailCache(itemSeq, entpName);
        if (cachedData) {
          console.log(`[약물 상관관계 분석] ✅ 캐시 사용: ${medicine.name}`);
          return {
            name: medicine.name,
            userMedicineId: medicine.id,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            publicData: cachedData,
            pillIdentification: null,
            productApproval: null,
            _fromCache: true,
          };
        }
      }

      // 캐시 미스 시 API 호출
      const [info, pillInfo, approvalInfo] = await Promise.all([
        this.externalApiClient.getMedicineInfo(medicine.name, 5),
        this.externalApiClient.getPillIdentificationInfo({ itemName: medicine.name, numOfRows: 3 }),
        this.externalApiClient.getDrugApprovalInfo({ itemName: medicine.name, numOfRows: 3 }),
      ]);

      const publicData = Array.isArray(info) && info.length > 0 ? info[0] : null;
      const pillData = Array.isArray(pillInfo) && pillInfo.length > 0 ? pillInfo[0] : null;
      const approvalData = Array.isArray(approvalInfo) && approvalInfo.length > 0 ? approvalInfo[0] : null;

      // 🆕 API 결과를 캐시에 저장
      if (publicData && publicData.itemSeq && publicData.entpName) {
        await this.supabaseService.saveMedicineDetailCache(
          publicData.itemSeq,
          publicData.entpName,
          publicData,
          '의약품(e약은요)',
        ).catch(err => console.warn('[캐시 저장 오류]:', err.message));
      }

      return {
        name: medicine.name,
        userMedicineId: medicine.id,
        dosage: medicine.dosage,
        frequency: medicine.frequency,
        publicData,
        pillIdentification: pillData,
        productApproval: approvalData,
        _fromCache: false,
      };
    });

    const drugDetails = await Promise.all(drugDetailsPromises);
    console.log(`[약물 상관관계 분석] 공공데이터 조회 완료`);

    // 3단계: AI로 약물 상호작용 분석
    const { GeminiClient } = await import('../ai/utils/gemini.client');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const geminiClient = new GeminiClient(geminiApiKey);

    console.log(`[약물 상관관계 분석] AI 분석 시작...`);
    
    // 🆕 Step 1: 각 약품의 정보를 AI가 분석 및 보완
    console.log(`[약물 상관관계 분석] Step 1: 각 약품 정보 분석 및 보완...`);
    const medicineInfoBatch = medicines.map(m => {
      const qrData = m.qr_code_data ? JSON.parse(m.qr_code_data) : {};
      return {
        name: m.name,
        publicData: qrData,
      };
    });
    
    const analyzedMedicineInfo = await geminiClient.analyzeMedicineInfoBatch(medicineInfoBatch);
    console.log(`[약물 상관관계 분석] ✅ ${analyzedMedicineInfo.length}개 약품 분석 완료`);
    
    // Step 2: 약물 상호작용 분석
    console.log(`[약물 상관관계 분석] Step 2: 약물 상호작용 분석...`);
    const analysisResult = await geminiClient.analyzeAllDrugInteractions(drugDetails, userProfile);

    console.log(`[약물 상관관계 분석] 완료`);
    console.log(`  - 위험한 조합: ${analysisResult.dangerousCombinations?.length || 0}개`);
    console.log(`  - 주의 필요: ${analysisResult.cautionCombinations?.length || 0}개`);
    console.log(`  - 긍정적 효과: ${analysisResult.synergisticEffects?.length || 0}개`);

    // 🆕 네트워크 도표용 interactions 배열 변환
    // Gemini의 결과를 네트워크 도표가 이해할 수 있는 format으로 변환
    const interactions = [];
    
    // 위험한 조합
    (analysisResult.dangerousCombinations || []).forEach((combo: any) => {
      // 약물명으로 medicines 배열에서 해당 약물 찾기
      const med1 = medicines.find(m => m.name === combo.drug1);
      const med2 = medicines.find(m => m.name === combo.drug2);
      
      if (med1 && med2) {
        interactions.push({
          medicines: [med1.id, med2.id],
          riskLevel: 'danger',
          description: combo.interaction,
          recommendation: combo.recommendation,
        });
      }
    });
    
    // 주의 필요 조합
    (analysisResult.cautionCombinations || []).forEach((combo: any) => {
      const med1 = medicines.find(m => m.name === combo.drug1);
      const med2 = medicines.find(m => m.name === combo.drug2);
      
      if (med1 && med2) {
        interactions.push({
          medicines: [med1.id, med2.id],
          riskLevel: 'caution',
          description: combo.interaction,
          recommendation: combo.recommendation,
        });
      }
    });
    
    // 긍정적 효과
    (analysisResult.synergisticEffects || []).forEach((effect: any) => {
      // synergistic effects는 2개 이상의 약물이 포함될 수 있음
      const medicineIds = effect.drugs
        .map((drugName: string) => medicines.find(m => m.name === drugName)?.id)
        .filter(Boolean);
      
      if (medicineIds.length >= 2) {
        interactions.push({
          medicines: medicineIds.slice(0, 2), // 네트워크 도표는 2개 약물 기준
          riskLevel: 'safe',
          description: effect.benefit,
          recommendation: effect.description,
        });
      }
    });

    console.log(`[약물 상관관계 분석] 네트워크 도표용 interactions 생성: ${interactions.length}개`);

    // 캐시 여부 판단 (내부 로깅용, 응답에는 포함하지 않음)
    const allFromCache = drugDetails.every((d: any) => d._fromCache === true);
    const cacheInfo = {
      total: medicines.length,
      fromCache: drugDetails.filter((d: any) => d._fromCache === true).length,
      fromAPI: drugDetails.filter((d: any) => d._fromCache === false).length,
    };
    
    if (allFromCache) {
      console.log(`[약물 상관관계 분석] 캐시에서 모든 정보 조회 (API 호출 0회)`);
    } else {
      console.log(`[약물 상관관계 분석] 캐시: ${cacheInfo.fromCache}개, API: ${cacheInfo.fromAPI}개`);
    }

    return {
      success: true,
      totalMedicines: medicines.length,
      medicines: medicines.map((m, idx) => ({ 
        id: m.id, 
        name: m.name, 
        dosage: m.dosage, 
        frequency: m.frequency,
        // 🆕 AI 분석 약품 정보 추가
        analyzedInfo: analyzedMedicineInfo[idx],
      })),
      analysis: {
        ...analysisResult,
        interactions, // 네트워크 도표용 interactions
      },
      dataSources: [
        '식품의약품안전처 e약은요 API',
        '식품의약품안전처 의약품 낱알식별 정보',
        '식품의약품안전처 의약품 제품 허가정보',
        'Gemini AI 분석',
      ],
    };
  }

  /**
   * 🆕 약물 상관관계 종합 분석 (스트리밍 버전)
   */
  async analyzeAllMedicineInteractionsStream(
    userId: string,
    sendEvent: (event: string, data: any) => void,
    userProfile?: { age?: number; gender?: string },
  ) {
    console.log(`[약물 상관관계 스트리밍 분석] 사용자 ${userId} 분석 시작`);

    // 시작 이벤트
    sendEvent('start', {
      message: '약물 상관관계 분석을 시작합니다...',
      stages: [
        '약물 목록 조회',
        '공공데이터 수집',
        '약물 정보 AI 분석',
        '약물 상호작용 AI 분석',
      ],
    });

    try {
      // 1단계: 약물 목록 조회
      sendEvent('stage', {
        stage: 1,
        name: '약물 목록 조회',
        status: 'in-progress',
        message: '등록된 약물 정보를 불러오는 중...',
      });

      const client = this.supabaseService.getClient();
      const { data: medicines } = await client
        .from('medicine_records')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (!medicines || medicines.length === 0) {
        sendEvent('stage', {
          stage: 1,
          status: 'complete',
          message: '등록된 약이 없습니다.',
        });
        sendEvent('result', {
          success: false,
          message: '분석할 약이 없습니다. 먼저 약을 등록해주세요.',
        });
        return;
      }

      sendEvent('stage', {
        stage: 1,
        status: 'complete',
        message: `${medicines.length}개 약물 조회 완료`,
      });

      // 2단계: 공공데이터 수집
      sendEvent('stage', {
        stage: 2,
        name: '공공데이터 수집',
        status: 'in-progress',
        message: '식약처 공공데이터 조회 중...',
      });

      const drugDetailsPromises = medicines.map(async (medicine) => {
        const qrCodeData = medicine.qr_code_data ? JSON.parse(medicine.qr_code_data) : {};
        const itemSeq = qrCodeData.itemSeq;
        const entpName = qrCodeData.entpName || medicine.drug_class;

        let publicData = qrCodeData;
        let pillData = null;
        let approvalData = null;
        let fromCache = false;

        if (itemSeq && entpName) {
          const cached = await this.supabaseService.getMedicineDetailCache(itemSeq, entpName);
          if (cached) {
            publicData = cached.api_data;
            pillData = cached.pill_data;
            approvalData = cached.approval_data;
            fromCache = true;
          }
        }

        return {
          name: medicine.name,
          publicData,
          pillIdentification: pillData,
          productApproval: approvalData,
          _fromCache: fromCache,
        };
      });

      const drugDetails = await Promise.all(drugDetailsPromises);

      sendEvent('stage', {
        stage: 2,
        status: 'complete',
        message: `공공데이터 수집 완료`,
      });

      // 3단계: 약물 정보 AI 분석
      sendEvent('stage', {
        stage: 3,
        name: '약물 정보 AI 분석',
        status: 'in-progress',
        message: 'AI가 각 약물 정보를 분석 중...',
      });

      const { GeminiClient } = await import('../ai/utils/gemini.client');
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
      }

      const geminiClient = new GeminiClient(geminiApiKey);

      const medicineInfoBatch = medicines.map(m => {
        const qrData = m.qr_code_data ? JSON.parse(m.qr_code_data) : {};
        return {
          name: m.name,
          publicData: qrData,
        };
      });

      const analyzedMedicineInfo = await geminiClient.analyzeMedicineInfoBatch(medicineInfoBatch);

      sendEvent('stage', {
        stage: 3,
        status: 'complete',
        message: `${analyzedMedicineInfo.length}개 약물 정보 분석 완료`,
      });

      // 4단계: 약물 상호작용 AI 분석
      sendEvent('stage', {
        stage: 4,
        name: '약물 상호작용 AI 분석',
        status: 'in-progress',
        message: 'AI가 약물 간 상호작용을 분석 중...',
      });

      const analysisResult = await geminiClient.analyzeAllDrugInteractions(drugDetails, userProfile);

      // 네트워크 도표용 interactions 변환
      const interactions = [];

      (analysisResult.dangerousCombinations || []).forEach((combo: any) => {
        const med1 = medicines.find(m => m.name === combo.drug1);
        const med2 = medicines.find(m => m.name === combo.drug2);
        if (med1 && med2) {
          interactions.push({
            medicines: [med1.id, med2.id],
            riskLevel: 'danger',
            description: combo.interaction,
            recommendation: combo.recommendation,
          });
        }
      });

      (analysisResult.cautionCombinations || []).forEach((combo: any) => {
        const med1 = medicines.find(m => m.name === combo.drug1);
        const med2 = medicines.find(m => m.name === combo.drug2);
        if (med1 && med2) {
          interactions.push({
            medicines: [med1.id, med2.id],
            riskLevel: 'caution',
            description: combo.interaction,
            recommendation: combo.recommendation,
          });
        }
      });

      (analysisResult.synergisticEffects || []).forEach((effect: any) => {
        const medicineIds = effect.drugs
          .map((drugName: string) => medicines.find(m => m.name === drugName)?.id)
          .filter(Boolean);
        if (medicineIds.length >= 2) {
          interactions.push({
            medicines: medicineIds.slice(0, 2),
            riskLevel: 'safe',
            description: effect.benefit,
            recommendation: effect.description,
          });
        }
      });

      sendEvent('stage', {
        stage: 4,
        status: 'complete',
        message: '약물 상호작용 분석 완료',
      });

      // 최종 결과 전송
      sendEvent('result', {
        success: true,
        data: {
          totalMedicines: medicines.length,
          medicines: medicines.map((m, idx) => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            analyzedInfo: analyzedMedicineInfo[idx],
          })),
          analysis: {
            ...analysisResult,
            interactions,
          },
          dataSources: [
            '식품의약품안전처 e약은요 API',
            '식품의약품안전처 의약품 낱알식별 정보',
            '식품의약품안전처 의약품 제품 허가정보',
            'Gemini AI 분석',
          ],
        },
      });

      console.log(`[약물 상관관계 스트리밍 분석] 완료`);
    } catch (error) {
      console.error('[약물 상관관계 스트리밍 분석] 오류:', error);
      throw error;
    }
  }
}
