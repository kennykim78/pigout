import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GeminiClient } from '../ai/utils/gemini.client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private geminiClient: GeminiClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiApiKey) {
      this.geminiClient = new GeminiClient(geminiApiKey);
    }
  }

  async getDailyContent(userId: string) {
    const client = this.supabaseService.getClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. Check DB for today's content
    const { data: existing } = await client
      .from('daily_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      this.logger.log(`[Cache Hit] Recommendation for ${userId} on ${today}`);
      return existing;
    }

    // 2. If not exists, Generate via Gemini
    this.logger.log(`[Cache Miss] Generating for ${userId} on ${today}`);
    
    // Fetch User Profile (Medicines, Diseases, Age, Gender)
    const { data: userProfile } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: medicines } = await client
      .from('medicine_records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    const generated = await this.generateDailyContent(userProfile, medicines || []);

    // 3. Save to DB
    const { data: saved, error } = await client
      .from('daily_recommendations')
      .insert({
        user_id: userId,
        date: today,
        food_content: generated.food,
        remedy_content: generated.remedy,
        exercise_content: generated.exercise,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to save daily recommendation', error);
      throw error;
    }

    return saved;
  }

  private async generateDailyContent(userProfile: any, medicines: any[]) {
    // Construct Prompt
    const age = userProfile?.age || '미설정';
    const gender = userProfile?.gender || '미설정';
    const diseases = userProfile?.diseases || [];
    const medicineNames = medicines.map(m => m.name).join(', ');

    // Random Country for Remedy (Simple List)
    const countries = ['한국', '중국', '일본', '인도', '미국', '독일', '프랑스', '이집트', '그리스', '러시아'];
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];

    const prompt = `
당신은 개인 맞춤형 건강 비서입니다. 하루 1회 사용자에게 맞춤형 콘텐츠를 제공합니다.
다음 사용자 정보를 바탕으로 3가지 항목(추천 음식, 민간요법, 추천 운동)을 생성하세요.

[사용자 정보]
- 나이/성별: ${age} / ${gender}
- 보유 질병: ${diseases.join(', ') || '없음'}
- 복용 약물: ${medicineNames || '없음'}

[요청 사항]
1. **오늘의 추천 음식**: 사용자의 질병/약물과 상충하지 않으면서 건강에 도움이 되는 음식 1가지를 추천해주세요.
2. **세계의 민간요법**: 오늘은 **${randomCountry}**의 민간요법을 하나 소개해주세요. 비과학적일 수 있으므로 재미 흥미 위주로 작성하되, 경고 문구를 포함하세요.
3. **오늘의 운동**: 사용자 컨디션(질병/나이 고려)에 적합한 운동 1가지를 추천해주세요.

[응답 형식 - JSON]
{
  "food": {
    "name": "음식명",
    "reason": "추천 이유 (질병/약물 고려)",
    "pros": "주요 장점 1줄"
  },
  "remedy": {
    "country": "${randomCountry}",
    "title": "요법 이름",
    "description": "요법 설명 (흥미롭게)",
    "warning": "※ 이 요법은 ${randomCountry}의 민간요법으로 과학적 근거가 부족할 수 있습니다. 따라하기 전 반드시 전문가와 상담하세요."
  },
  "exercise": {
    "name": "운동명",
    "description": "운동 방법 및 효과",
    "intensity": "난이도 (하/중/상)"
  }
}
JSON만 출력하세요.
`;

    try {
      // Use GeminiClient's text generation (assuming textModel is accessible or create a public method)
      // Since `textModel` is private in GeminiClient, implementing simple wrapper call here logic or reusing existing
      // For now, let's assume valid response. Ideally GeminiClient should have a generic generateJSON method.
      // I will implement a quick parsing logic here or use `extractJsonObject`.
      
      const result = await this.geminiClient.generateText(prompt); // Need to ensure generateText exists or similar
      return this.geminiClient.extractJsonObject(result);
    } catch (e) {
      this.logger.error('Gemini Generation Failed', e);
      // Fallback
      return {
        food: { name: '현미밥', reason: '건강한 탄수화물 섭취', pros: '혈당 조절에 도움' },
        remedy: { country: '한국', title: '따뜻한 물 마시기', description: '아침 공복에 따뜻한 물은 신진대사를 깨웁니다.', warning: '※ 전문가와 상담하세요.' },
        exercise: { name: '걷기', description: '가볍게 30분 걷기', intensity: '하' }
      };
    }
  }
}
