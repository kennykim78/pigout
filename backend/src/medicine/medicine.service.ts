import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QrParser } from './utils/qr-parser';
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
   * QR 코드 스캔하여 약 정보 저장
   */
  async scanQrCode(userId: string, qrData: string, dosage?: string, frequency?: string) {
    const client = this.supabaseService.getClient();

    // QR 데이터 유효성 검증
    if (!QrParser.validate(qrData)) {
      throw new BadRequestException('유효하지 않은 QR 코드입니다.');
    }

    // QR 데이터 파싱
    const parsed = QrParser.parse(qrData);

    if (!parsed.medicineName) {
      throw new BadRequestException('약품명을 추출할 수 없습니다.');
    }

    // medicine_list에서 약품 정보 조회 (코드 기준)
    let medicineData = null;
    let medicineId = null;
    if (parsed.medicineCode) {
      const { data: medicine } = await client
        .from('medicine_list')
        .select('*')
        .eq('medicine_code', parsed.medicineCode)
        .single();

      if (medicine) {
        medicineId = medicine.id;
        medicineData = medicine;
      }
    }

    // API에서 약품 정보 검색 (상세 정보 얻기 위해)
    let apiMedicineData: any = null;
    try {
      const searchResults = await this.searchMedicine(parsed.medicineName, 1);
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        apiMedicineData = searchResults[0];
      } else if (searchResults && typeof searchResults === 'object' && 'results' in searchResults) {
        const results = (searchResults as any).results;
        if (Array.isArray(results) && results.length > 0) {
          apiMedicineData = results[0];
        }
      }
    } catch (error) {
      console.log('[scanQrCode] API 검색 실패:', (error as any).message);
    }

    // 사용자 약 기록 저장 (API 데이터와 DB 데이터 모두 저장)
    const { data, error } = await client
      .from('medicine_records')
      .insert({
        user_id: userId,
        // DB 저장용 기본 필드
        name: parsed.medicineName,
        dosage: dosage || null,
        frequency: frequency || null,
        qr_code_data: qrData,
        is_active: true,
        // API 데이터 저장 (상세 정보)
        item_name: apiMedicineData?.itemName || parsed.medicineName,
        efcy_qesitm: apiMedicineData?.efcyQesitm || '',
        use_method_qesitm: apiMedicineData?.useMethodQesitm || '',
        atpn_warn_qesitm: apiMedicineData?.atpnWarnQesitm || '',
        intrc_qesitm: apiMedicineData?.intrcQesitm || '',
        se_qesitm: apiMedicineData?.seQesitm || '',
        deposit_method_qesitm: apiMedicineData?.depositMethodQesitm || '',
        entp_name: apiMedicineData?.entpName || '',
        item_seq: apiMedicineData?.itemSeq || '',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      medicineRecord: data,
      parsedInfo: parsed,
    };
  }

  /**
   * 약품명, 효능(질병), 제조사로 검색 (e약은요 API 사용)
   * API 결과 없을 때 AI가 제품 유형 판단 후 올바른 탭 안내
   */
  async searchMedicine(keyword: string, numOfRows: number = 1000) {
    try {
      console.log(`[약품 검색] 키워드: ${keyword}, 요청 수: ${numOfRows}`);
      
      // 사용자가 요청한 numOfRows 개수를 존중하되, 최소 100개는 조회하여 필터링 여유 확보
      const apiLimit = Math.max(numOfRows * 2, 100);
      
      // 1. 약품명으로 검색
      let nameResults = await this.externalApiClient.getMedicineInfo(keyword, apiLimit);
      
      // 2. 효능(질병)으로도 검색
      const efficacyResults = await this.externalApiClient.searchMedicineByEfficacy(keyword, apiLimit);
      
      // 3. 제조사로도 검색
      const manufacturerResults = await this.externalApiClient.searchMedicineByManufacturer(keyword, apiLimit);
      
      // 🆕 AI 생성 데이터 필터링 - AI 더미 데이터는 실제 API 결과가 있으면 제거
      // AI 생성 데이터는 itemSeq가 "AI_"로 시작함
      const hasRealNameResults = nameResults.some((item: any) => 
        item.itemSeq && !item.itemSeq.startsWith('AI_')
      );
      
      // 약품명 검색 결과에 AI 생성 데이터만 있고, 효능이나 제조사에서 실제 데이터가 있으면 AI 데이터 제거
      if (!hasRealNameResults && (efficacyResults.length > 0 || manufacturerResults.length > 0)) {
        console.log(`[약품 검색] 약품명 검색에서 AI 생성 데이터만 발견 - 제거`);
        nameResults = [];
      }
      
      // 4. 결과 병합 및 중복 제거 (itemSeq 기준)
      const combinedResults = [...nameResults, ...efficacyResults, ...manufacturerResults];
      const uniqueResults = Array.from(
        new Map(combinedResults.map(item => [item.itemSeq, item])).values()
      );
      
      console.log(`[약품 검색] 약품명: ${nameResults.length}건, 효능: ${efficacyResults.length}건, 제조사: ${manufacturerResults.length}건, 중복제거 후: ${uniqueResults.length}건`);
      
      if (!uniqueResults || uniqueResults.length === 0) {
        console.log(`[약품 검색] API 결과 없음 - 제품 유형 판단 시작`);
        
        // 건강기능식품 API에서 검색해보기
        const healthFoodResults = await this.externalApiClient.searchHealthFunctionalFood(keyword, 5);
        
        if (healthFoodResults && healthFoodResults.length > 0) {
          // 건강기능식품에서 발견됨 - 탭 이동 안내
          console.log(`[약품 검색] ✅ 건강기능식품 탭에서 ${healthFoodResults.length}건 발견 - 탭 이동 안내`);
          return {
            results: [],
            suggestion: {
              type: 'wrongTab',
              correctTab: 'healthfood',
              message: `"${keyword}"은(는) 건강기능식품입니다. 건강기능식품 탭에서 검색해주세요.`,
              foundCount: healthFoodResults.length,
            }
          };
        }
        
        // AI에게 제품 유형 판단 요청
        const productType = await this.externalApiClient.classifyProductType(keyword);
        console.log(`[약품 검색] AI 제품 유형 판단: ${productType}`);
        
        if (productType === 'healthFood') {
          return {
            results: [],
            suggestion: {
              type: 'wrongTab',
              correctTab: 'healthfood',
              message: `"${keyword}"은(는) 건강기능식품으로 보입니다. 건강기능식품 탭에서 검색해주세요.`,
              foundCount: 0,
            }
          };
        }
        
        // 의약품이 맞는데 없는 경우 - DB 검색 시도
        const { data, error } = await this.supabaseService
          .getClient()
          .from('medicine_list')
          .select('id, name, manufacturer, purpose, side_effects')
          .ilike('name', `%${keyword}%`);

        if (error) throw error;
        return data || [];
      }

      // API 결과를 프론트엔드 형식으로 변환 (limit 제한 없이 모든 결과 반환)
      const results = uniqueResults.map((item: any) => ({
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
      }));

      // 🆕 각 약품을 공용 캐시에 저장 (itemSeq+entpName 단위)
      for (const result of results) {
        // API 전체 결과를 캐시에 저장
        const fullMedicineData = uniqueResults.find(
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
  async searchHealthFood(keyword: string, numOfRows: number = 1000) {
    try {
      console.log(`[건강기능식품 검색] 키워드: ${keyword}, 요청 수: ${numOfRows}`);
      
      // 사용자가 요청한 numOfRows 개수를 존중하되, 최소 100개는 조회하여 필터링 여유 확보
      const apiLimit = Math.max(numOfRows * 2, 100);
      
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
        // API 결과를 프론트엔드 형식으로 변환
        const formattedResults = results.map((item: any) => ({
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

      // 감지된 약품들에 대해 공공데이터 API로 검증 및 상세 정보 조회
      const verifiedMedicines = [];

      for (const medicine of detectedMedicines) {
        console.log(`[약품 이미지 분석] 검증 중: ${medicine.name}`);
        
        // e약은요 API로 약품 검색
        const apiResults = await this.externalApiClient.getMedicineInfo(medicine.name, 3);
        
        if (apiResults && apiResults.length > 0) {
          // API에서 찾은 결과
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
              efcyQesitm: matched.efcyQesitm,
              useMethodQesitm: matched.useMethodQesitm,
              atpnQesitm: matched.atpnQesitm,
              intrcQesitm: matched.intrcQesitm,
              seQesitm: matched.seQesitm,
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
                efcyQesitm: matched.CLASS_NAME || '',
                useMethodQesitm: '',
                atpnQesitm: '',
                intrcQesitm: '',
                seQesitm: '',
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

    console.log(`[약 등록] ${itemName} (${entpName})`);

    // 완전한 약 정보를 DB에 저장 (API 필드 + DB 필드)
    const recordData = {
      user_id: userId,
      name: itemName,
      item_name: itemName,  // API 필드: 약품명
      drug_class: entpName,
      entp_name: entpName,  // API 필드: 제조사
      dosage: medicineData.dosage || null,
      frequency: medicineData.frequency || null,
      // API 상세 정보 필드
      item_seq: itemSeq || null,
      efcy_qesitm: medicineData.efcyQesitm || null,  // 효능
      use_method_qesitm: medicineData.useMethodQesitm || null,  // 용법
      atpn_warn_qesitm: medicineData.atpnWarnQesitm || null,  // 주의사항
      intrc_qesitm: medicineData.intrcQesitm || null,  // 상호작용
      se_qesitm: medicineData.seQesitm || null,  // 부작용
      deposit_method_qesitm: medicineData.depositMethodQesitm || null,  // 보관방법
      // QR 데이터 (이전 호환성)
      qr_code_data: JSON.stringify({
        itemSeq: itemSeq,
        efficacy: medicineData.efcyQesitm,
        manufacturer: entpName,
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

    // 🆕 약품 정보를 공용 캐시에 저장 (다른 사용자도 활용 가능)
    if (itemSeq && entpName) {
      try {
        const fullMedicineInfo = await this.externalApiClient.getMedicineInfo(itemName, 1);
        if (fullMedicineInfo && fullMedicineInfo.length > 0) {
          const apiData = fullMedicineInfo[0];
          await this.supabaseService.saveMedicineDetailCache(
            itemSeq,
            entpName,
            apiData,
            '의약품(e약은요)',
          );
        }
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
   * @param withAnalysis true면 AI 분석 결과도 함께 반환
   */
  async getMyMedicines(userId: string, activeOnly: boolean = true, withAnalysis: boolean = false) {
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

    // 분석 결과 미포함 시 기존 방식 반환
    if (!withAnalysis) {
      return data;
    }

    // 분석 결과 포함 시 AI 분석 수행
    let analysis = null;
    if (data && data.length >= 1) {
      try {
        analysis = await this.performQuickAnalysis(data);
      } catch (err) {
        console.warn('[AI 분석 오류]:', err.message);
      }
    }

    return {
      medicines: data,
      analysis,
    };
  }

  /**
   * 약품 목록에 대한 빠른 AI 분석 수행
   * (레이더 차트와 한줄평용 간략 분석)
   */
  private async performQuickAnalysis(medicines: any[]) {
    const { GeminiClient } = await import('../ai/utils/gemini.client');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.warn('[AI 분석] GEMINI_API_KEY 미설정');
      return null;
    }

    const geminiClient = new GeminiClient(geminiApiKey);

    // 캐시에서 약품 상세 정보 조회
    const drugDetailsPromises = medicines.map(async (medicine: any) => {
      let itemSeq: string | null = null;
      let entpName: string | null = null;
      
      try {
        const qrData = medicine.qr_code_data ? JSON.parse(medicine.qr_code_data) : {};
        itemSeq = qrData.itemSeq || null;
        entpName = qrData.manufacturer || medicine.drug_class || null;
      } catch (e) {
        // JSON 파싱 실패 시 무시
      }

      // 캐시에서 조회
      let cachedData = null;
      if (itemSeq && entpName) {
        cachedData = await this.supabaseService.getMedicineDetailCache(itemSeq, entpName);
      }

      return {
        name: medicine.name,
        dosage: medicine.dosage,
        frequency: medicine.frequency,
        efcyQesitm: cachedData?.efcyQesitm || '',
        useMethodQesitm: cachedData?.useMethodQesitm || '',
        atpnWarnQesitm: cachedData?.atpnWarnQesitm || '',
        intrcQesitm: cachedData?.intrcQesitm || '',
        seQesitm: cachedData?.seQesitm || '',
      };
    });

    const drugDetails = await Promise.all(drugDetailsPromises);

    // AI로 약물 분석 (레이더 차트용 성분 분류 + 상호작용)
    const analysisResult = await geminiClient.analyzeForDashboard(drugDetails);

    return analysisResult;
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
   * 약 복용 기록 업데이트 (비활성화 등)
   */
  async updateMedicineRecord(userId: string, recordId: string, updates: any) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('medicine_records')
      .update(updates)
      .eq('id', recordId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

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
  async analyzeAllMedicineInteractions(userId: string) {
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
    const analysisResult = await geminiClient.analyzeAllDrugInteractions(drugDetails);

    console.log(`[약물 상관관계 분석] 완료`);
    console.log(`  - 위험한 조합: ${analysisResult.dangerousCombinations?.length || 0}개`);
    console.log(`  - 주의 필요: ${analysisResult.cautionCombinations?.length || 0}개`);
    console.log(`  - 긍정적 효과: ${analysisResult.synergisticEffects?.length || 0}개`);

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
      medicines: medicines.map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })),
      analysis: analysisResult,
      dataSources: [
        '식품의약품안전처 e약은요 API',
        '식품의약품안전처 의약품 낱알식별 정보',
        '식품의약품안전처 의약품 제품 허가정보',
        'Gemini AI 분석',
      ],
    };
  }
}
