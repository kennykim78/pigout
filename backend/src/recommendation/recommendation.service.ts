import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { GeminiClient } from "../ai/utils/gemini.client";
import { ImageService } from "../image/image.service";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private geminiClient: GeminiClient;
  private readonly POOL_SIZE = 30; // 30일 풀

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly imageService: ImageService
  ) {
    const geminiApiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (geminiApiKey) {
      this.geminiClient = new GeminiClient(geminiApiKey);
    }
  }

  /**
   * 나이 → 나이대 변환 (10대 단위)
   */
  private getAgeGroup(age: number | string): string {
    if (!age || age === "미설정") return "미설정";
    const numAge = typeof age === "string" ? parseInt(age) : age;
    if (isNaN(numAge)) return "미설정";

    const decade = Math.floor(numAge / 10) * 10;
    return `${decade}대`;
  }

  /**
   * 글로벌 캐시 키 생성
   */
  private generateCacheKey(
    ageGroup: string,
    gender: string,
    diseases: string[]
  ): string {
    const sortedDiseases = [...diseases].sort().join(",") || "없음";
    return `${ageGroup}_${gender || "미설정"}_${sortedDiseases}`;
  }

  /**
   * 해시 기반 랜덤 인덱스 계산 (같은 날, 같은 조건 → 같은 인덱스)
   */
  private getRandomIndex(cacheKey: string, date: string): number {
    const hash = crypto
      .createHash("md5")
      .update(cacheKey + date)
      .digest("hex");
    const num = parseInt(hash.substring(0, 8), 16);
    return num % this.POOL_SIZE;
  }

  async getDailyContent(userId: string) {
    const client = this.supabaseService.getClient();
    const today = new Date().toISOString().split("T")[0];

    // 1. 사용자 프로필 조회
    const { data: userProfile } = await client
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    const ageGroup = this.getAgeGroup(userProfile?.age);
    const gender = userProfile?.gender || "미설정";
    const diseases = userProfile?.diseases || [];
    const cacheKey = this.generateCacheKey(ageGroup, gender, diseases);

    // 오늘의 랜덤 인덱스 (해시 기반)
    const contentIndex = this.getRandomIndex(cacheKey, today);

    // 🔍 디버깅: 사용자 프로필과 캐시 키 상세 로그
    this.logger.log(
      `[Recommendation] User: ${userId}, Age: ${userProfile?.age}, Gender: ${gender}, Diseases: ${JSON.stringify(diseases)}`
    );
    this.logger.log(
      `[Recommendation] CacheKey: "${cacheKey}", Index: ${contentIndex}/30`
    );

    // 2. 오늘 이 사용자가 이미 받은 추천이 있는지 확인 (개인 캐시)
    const { data: userToday } = await client
      .from("daily_recommendations")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (userToday) {
      this.logger.log(
        `[User Cache Hit] ${userId} already has today's recommendation`
      );
      return userToday;
    }

    // 3. 글로벌 캐시 풀에서 해당 인덱스 조회
    const { data: globalCache } = await client
      .from("recommendation_global_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .eq("content_index", contentIndex)
      .gt("expires_at", new Date().toISOString())
      .single();

    let recommendationContent;

    if (globalCache) {
      // 글로벌 캐시 히트! AI 호출 없이 반환
      this.logger.log(
        `[Global Cache Hit] ✅ Key: ${cacheKey}, Index: ${contentIndex}`
      );

      // 히트 카운트 증가
      await client
        .from("recommendation_global_cache")
        .update({ hit_count: (globalCache.hit_count || 0) + 1 })
        .eq("id", globalCache.id);

      recommendationContent = {
        food: globalCache.food_content,
        remedy: globalCache.remedy_content,
        exercise: globalCache.exercise_content,
      };
    } else {
      // 글로벌 캐시 미스 → AI 생성
      this.logger.log(
        `[Global Cache Miss] 🔄 Generating Key: ${cacheKey}, Index: ${contentIndex}`
      );

      const { data: medicines } = await client
        .from("medicine_records")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      recommendationContent = await this.generateDailyContent(
        userProfile,
        medicines || []
      );

      // 글로벌 캐시 풀에 저장 (90일 만료 = 분기별 갱신)
      const { error: cacheError } = await client
        .from("recommendation_global_cache")
        .insert({
          cache_key: cacheKey,
          content_index: contentIndex,
          age_group: ageGroup,
          gender: gender,
          diseases: diseases,
          food_content: recommendationContent.food,
          remedy_content: recommendationContent.remedy,
          exercise_content: recommendationContent.exercise,
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          hit_count: 0,
        });

      if (cacheError) {
        this.logger.warn("Failed to save global cache", cacheError);
      } else {
        this.logger.log(
          `[Global Cache Saved] ✅ Key: ${cacheKey}, Index: ${contentIndex}`
        );
      }
    }

    // 4. 사용자별 일일 기록 저장 (개인 히스토리용)
    const { data: saved, error } = await client
      .from("daily_recommendations")
      .insert({
        user_id: userId,
        date: today,
        food_content: recommendationContent.food,
        remedy_content: recommendationContent.remedy,
        exercise_content: recommendationContent.exercise,
      })
      .select()
      .single();

    if (error) {
      this.logger.error("Failed to save daily recommendation", error);
      throw error;
    }

    return saved;
  }

  private async generateDailyContent(userProfile: any, medicines: any[]) {
    const age = userProfile?.age || "미설정";
    const gender = userProfile?.gender || "미설정";
    const diseases = userProfile?.diseases || [];
    const medicineNames = medicines.map((m) => m.name).join(", ");

    const countries = [
      "한국",
      "중국",
      "일본",
      "인도",
      "미국",
      "독일",
      "프랑스",
      "이집트",
      "그리스",
      "러시아",
    ];
    const randomCountry =
      countries[Math.floor(Math.random() * countries.length)];

    const prompt = `
당신은 개인 맞춤형 건강 비서입니다. 하루 1회 사용자에게 맞춤형 콘텐츠를 제공합니다.
다음 사용자 정보를 바탕으로 3가지 항목(추천 음식, 민간요법, 추천 운동)을 생성하세요.

[사용자 정보]
- 나이/성별: ${age} / ${gender}
- 보유 질병: ${diseases.join(", ") || "없음"}
- 복용 약물: ${medicineNames || "없음"}

[요청 사항]
1. **오늘의 추천 음식**: 사용자의 질병/약물과 상충하지 않으면서 건강에 도움이 되는 음식 1가지를 추천해주세요.
2. **세계의 민간요법**: 오늘은 **${randomCountry}**의 민간요법을 하나 소개해주세요. 비과학적일 수 있으므로 재미 흥미 위주로 작성하되, 경고 문구를 포함하세요.
3. **오늘의 운동**: 사용자 컨디션(질병/나이 고려)에 적합한 운동 1가지를 추천해주세요.

[응답 형식 - JSON]
{
  "food": {
    "name": "음식명",
    "reason": "추천 이유 (질병/약물 고려)",
    "pros": "주요 장점 1줄",
    "searchKeyword": "음식 검색 키워드 (예: 현미밥 효능)"
  },
  "remedy": {
    "country": "${randomCountry}",
    "title": "요법 이름",
    "description": "요법 설명 (흥미롭게)",
    "warning": "※ 이 요법은 ${randomCountry}의 민간요법으로 과학적 근거가 부족할 수 있습니다. 따라하기 전 반드시 전문가와 상담하세요.",
    "searchKeyword": "요법 검색 키워드 (예: 그리스 올리브오일 민간요법)"
  },
  "exercise": {
    "name": "운동명",
    "description": "운동 방법 및 효과",
    "intensity": "난이도 (하/중/상)",
    "searchKeyword": "운동 검색 키워드 (예: 30분 걷기 운동)"
  }
}
JSON만 출력하세요.
`;

    try {
      const result = await this.geminiClient.generateText(prompt);
      const parsed = this.geminiClient.extractJsonObject(result);

      // 🖼️ 이미지 및 링크 생성 (음식 & 운동)
      const foodName = parsed.food?.name;
      const exerciseName = parsed.exercise?.name;
      const foodKeyword = parsed.food?.searchKeyword || foodName;
      const exerciseKeyword = parsed.exercise?.searchKeyword || exerciseName;

      // 번역은 여기서 한 번만 해서 넘김 (FoodService 등에서도 재사용하므로)
      const [translatedFood, translatedExercise] = await Promise.all([
        this.imageService.translateToEnglish(foodKeyword),
        this.imageService.translateToEnglish(exerciseKeyword),
      ]);

      // 최상위 로직 수행 (실제 URL 찾기 및 이미지 매칭)
      const [foodResult, exerciseResult] = await Promise.all([
        this.generateContentResult(foodKeyword, translatedFood, "food"),
        this.generateContentResult(
          exerciseKeyword,
          translatedExercise,
          "exercise"
        ),
      ]);

      // 🏳️ 국가 국기 매핑
      const flagMap: Record<string, string> = {
        한국: "🇰🇷",
        중국: "🇨🇳",
        일본: "🇯🇵",
        인도: "🇮🇳",
        미국: "🇺🇸",
        독일: "🇩🇪",
        프랑스: "🇫🇷",
        이집트: "🇪🇬",
        그리스: "🇬🇷",
        러시아: "🇷🇺",
      };

      const remedyCountry = parsed.remedy?.country || "한국";
      const flagEmoji = flagMap[remedyCountry] || "🏳️";

      return {
        ...parsed,
        food: {
          ...parsed.food,
          imageUrl: foodResult.imageUrl,
          relatedLink: foodResult.link,
        },
        remedy: {
          ...parsed.remedy,
          flag: flagEmoji,
          relatedLink: `https://www.google.com/search?q=${encodeURIComponent(
            parsed.remedy?.searchKeyword ||
              remedyCountry + " " + parsed.remedy?.title
          )}`,
        },
        exercise: {
          ...parsed.exercise,
          imageUrl: exerciseResult.imageUrl,
          relatedLink: exerciseResult.link,
        },
      };
    } catch (e) {
      this.logger.error("Gemini Generation Failed", e);
      return {
        food: {
          name: "현미밥",
          reason: "건강한 탄수화물 섭취",
          pros: "혈당 조절에 도움",
          imageUrl: "",
          relatedLink: "https://www.youtube.com/results?search_query=현미밥",
        },
        remedy: {
          country: "한국",
          title: "따뜻한 물 마시기",
          description: "아침 공복에 따뜻한 물은 신진대사를 깨웁니다.",
          warning: "※ 전문가와 상담하세요.",
          flag: "🇰🇷",
          relatedLink: "https://www.google.com/search?q=따뜻한 물 효능",
        },
        exercise: {
          name: "걷기",
          description: "가볍게 30분 걷기",
          intensity: "하",
          imageUrl: "",
          relatedLink: "https://www.youtube.com/results?search_query=걷기 운동",
        },
      };
    }
  }

  /**
   * 콘텐츠 결과 생성 (실제 URL + 이미지)
   * 우선순위: Google Search -> OG Image -> Unsplash Fallback
   */
  private async generateContentResult(
    keyword: string,
    englishKeyword: string,
    type: "food" | "exercise"
  ): Promise<{ imageUrl: string; link: string }> {
    const defaultLinks = {
      food: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        keyword + " 레시피"
      )}`,
      exercise: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        keyword + " 운동법"
      )}`,
    };

    try {
      // 1. 실제 URL 찾기 (Google Custom Search)
      const searchPrefix = type === "exercise" ? "운동 방법 " : "추천 레시피 ";
      const realUrl = await this.imageService.searchCrawlableUrl(
        searchPrefix + keyword
      );

      let imageUrl = "";
      let finalLink = realUrl || defaultLinks[type];

      if (realUrl) {
        this.logger.log(`[Link] Found Real URL: ${realUrl}`);
        // 2. OG 이미지 추출
        const ogImageUrl = await this.imageService.fetchOgImage(realUrl);
        if (ogImageUrl) {
          this.logger.log(`[Image] Found OG Image: ${ogImageUrl}`);
          imageUrl =
            (await this.imageService.processAndUploadImage(
              ogImageUrl,
              `${type}_og_${Date.now()}`
            )) || "";
        }
      }

      // 3. OG 이미지 실패 시 Unsplash Fallback
      if (!imageUrl) {
        this.logger.log(
          `[Image] OG Image failed, falling back to Unsplash for: ${englishKeyword}`
        );
        const searchKeyword =
          type === "exercise"
            ? `${englishKeyword} workout`
            : `${englishKeyword} food`;
        const unsplashUrl = await this.imageService.searchUnsplash(
          searchKeyword
        );
        if (unsplashUrl) {
          imageUrl =
            (await this.imageService.processAndUploadImage(
              unsplashUrl,
              `${type}_unsplash_${Date.now()}`
            )) || "";
        }
      }

      return { imageUrl, link: finalLink };
    } catch (e) {
      this.logger.error(`[Image/Link] Pipeline failed for ${keyword}`, e);
      return { imageUrl: "", link: defaultLinks[type] };
    }
  }
}
