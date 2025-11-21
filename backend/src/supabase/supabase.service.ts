import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Key must be provided');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // 음식 정보 저장
  async saveFoodAnalysis(data: {
    foodName: string;
    imageUrl?: string;
    score?: number;
    analysis?: string;
    diseases?: string[];
    detailedAnalysis?: string;
  }) {
    // camelCase를 snake_case로 변환
    const dbData: any = {
      food_name: data.foodName,
      image_url: data.imageUrl,
      score: data.score,
      analysis: data.analysis,
      diseases: data.diseases || [], // 질병 정보 추가
    };
    
    // detailedAnalysis가 있으면 추가 (선택적)
    if (data.detailedAnalysis) {
      dbData.detailed_analysis = data.detailedAnalysis;
    }

    const { data: result, error } = await this.supabase
      .from('food_analysis')
      .insert([dbData])
      .select();

    if (error) {
      console.error('Supabase save error:', error);
      throw new HttpException(
        `데이터베이스 저장 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return result;
  }

  // 음식 정보 조회
  async getFoodAnalysis(id: string) {
    const { data, error } = await this.supabase
      .from('food_analysis')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // 이미지 업로드
  async uploadImage(file: Buffer, fileName: string, bucketName: string = 'food-images') {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new HttpException(
        `이미지 업로드 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return { path: data.path, publicUrl };
  }
}
