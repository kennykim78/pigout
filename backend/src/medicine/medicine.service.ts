import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QrParser } from './utils/qr-parser';
import { ExternalApiClient } from '../ai/utils/external-api.client';

@Injectable()
export class MedicineService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly externalApiClient: ExternalApiClient,
  ) {}

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
    let medicineId = null;
    if (parsed.medicineCode) {
      const { data: medicine } = await client
        .from('medicine_list')
        .select('id')
        .eq('medicine_code', parsed.medicineCode)
        .single();

      if (medicine) {
        medicineId = medicine.id;
      }
    }

    // 사용자 약 기록 저장
    const { data, error } = await client
      .from('medicine_records')
      .insert({
        user_id: userId,
        medicine_id: medicineId,
        medicine_name: parsed.medicineName,
        dosage: dosage || null,
        frequency: frequency || null,
        qr_data: qrData,
        is_active: true,
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
   * 약품명으로 검색 (e약은요 API 사용)
   */
  async searchMedicine(keyword: string, limit: number = 20) {
    try {
      console.log(`[약품 검색] 키워드: ${keyword}`);
      
      // e약은요 API로 검색
      const apiResults = await this.externalApiClient.getMedicineInfo(keyword);
      
      if (!apiResults || apiResults.length === 0) {
        console.log(`[약품 검색] API 결과 없음, DB 검색 시도`);
        // API 결과 없으면 로컬 DB 검색
        const { data, error } = await this.supabaseService
          .getClient()
          .from('medicine_list')
          .select('id, name, manufacturer, purpose, side_effects')
          .ilike('name', `%${keyword}%`)
          .limit(limit);

        if (error) throw error;
        return data || [];
      }

      // API 결과를 프론트엔드 형식으로 변환
      const results = apiResults.slice(0, limit).map((item: any) => ({
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

      console.log(`[약품 검색] ${results.length}건 검색됨`);
      return results;
    } catch (error) {
      console.error('[약품 검색] 오류:', error.message);
      throw error;
    }
  }

  /**
   * 검색 결과에서 약 직접 등록
   */
  async addMedicineFromSearch(
    userId: string,
    itemName: string,
    entpName: string,
    itemSeq?: string,
    efcyQesitm?: string,
    dosage?: string,
    frequency?: string,
  ) {
    const client = this.supabaseService.getClient();

    console.log(`[약 등록] ${itemName} (${entpName})`);

    // 사용자 약 기록 저장
    const { data, error } = await client
      .from('medicine_records')
      .insert({
        user_id: userId,
        medicine_id: null, // API 검색 결과는 medicine_list에 없을 수 있음
        medicine_name: itemName,
        manufacturer: entpName,
        item_seq: itemSeq,
        efficacy: efcyQesitm,
        dosage: dosage || null,
        frequency: frequency || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[약 등록 실패]:', error);
      throw error;
    }

    console.log(`[약 등록 완료] ID: ${data.id}`);
    return {
      success: true,
      medicineRecord: data,
    };
  }

  /**
   * 사용자의 복용 약 목록 조회
   */
  async getMyMedicines(userId: string, activeOnly: boolean = true) {
    let query = this.supabaseService
      .getClient()
      .from('medicine_records')
      .select('*, medicine_list(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
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
}
