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
      `[Recommendation] User: ${userId}, Age: ${
        userProfile?.age
      }, Gender: ${gender}, Diseases: ${JSON.stringify(diseases)}`
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

    // 운동 카테고리 다양화
    const exerciseCategories = [
      "실내 스트레칭",
      "요가 동작",
      "맨몸 근력 운동",
      "필라테스 동작",
      "유산소 운동",
      "명상 및 호흡법",
      "사무실에서 할 수 있는 운동",
      "코어 강화 운동",
    ];
    const randomExerciseCategory =
      exerciseCategories[Math.floor(Math.random() * exerciseCategories.length)];

    const prompt = `
당신은 개인 맞춤형 건강 비서입니다. 하루 1회 사용자에게 맞춤형 콘텐츠를 제공합니다.
다음 사용자 정보를 바탕으로 3가지 항목(추천 음식, 민간요법, 추천 운동)을 생성하세요.

[사용자 정보]
- 나이/성별: ${age} / ${gender}
- 보유 질병: ${diseases.join(", ") || "없음"}
- 복용 약물: ${medicineNames || "없음"}

[요청 사항 - 간결하게 작성]
- 모든 설명은 **핵심만 1-2문장으로 축약**하여 작성하세요.

1. **오늘의 추천 음식**: 사용자의 질병/약물과 상충하지 않는 건강 음식 1가지.
2. **세계의 민간요법**: **${randomCountry}**의 민간요법 1가지. 재미 위주로.
3. **오늘의 추천 운동**: **"${randomExerciseCategory}"** 카테고리에서, 구체적인 운동 1가지. (걷기/달리기 제외)

[응답 형식 - JSON]
{
  "food": {
    "name": "음식명",
    "summary": "핵심 장점 1문장",
    "searchKeyword": "음식 검색 키워드"
  },
  "remedy": {
    "country": "${randomCountry}",
    "title": "요법 이름",
    "summary": "요법 설명 1-2문장",
    "searchKeyword": "요법 검색 키워드"
  },
  "exercise": {
    "name": "운동명",
    "summary": "운동 효과 1문장",
    "intensity": "난이도 (하/중/상)",
    "searchKeyword": "운동 검색 키워드"
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
      const remedyKeyword =
        parsed.remedy?.searchKeyword ||
        parsed.remedy?.country + " " + parsed.remedy?.title;

      const [foodResult, exerciseResult, remedyResult] = await Promise.all([
        this.generateContentResult(foodKeyword, translatedFood, "food"),
        this.generateContentResult(
          exerciseKeyword,
          translatedExercise,
          "exercise"
        ),
        this.generateRemedyContentResult(remedyKeyword), // remedy는 Google 검색(블로그/기사)
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
          videoId: foodResult.videoId,
          relatedLink: foodResult.link,
        },
        remedy: {
          ...parsed.remedy,
          flag: flagEmoji,
          imageUrl: remedyResult.imageUrl,
          videoId: remedyResult.videoId,
          relatedLink: remedyResult.link,
        },
        exercise: {
          ...parsed.exercise,
          imageUrl: exerciseResult.imageUrl,
          videoId: exerciseResult.videoId,
          relatedLink: exerciseResult.link,
        },
      };
    } catch (e) {
      this.logger.error("Gemini Generation Failed", e);
      return {
        food: {
          name: "현미밥",
          summary: "혈당 조절에 도움되는 건강한 탄수화물",
          imageUrl: "",
          videoId: null,
          relatedLink: "https://www.youtube.com/results?search_query=현미밥",
        },
        remedy: {
          country: "한국",
          title: "따뜻한 물 마시기",
          summary: "아침 공복에 따뜻한 물은 신진대사를 깨웁니다.",
          flag: "🇰🇷",
          imageUrl: "",
          videoId: null,
          relatedLink: "https://www.google.com/search?q=따뜻한+물+효능",
        },
        exercise: {
          name: "스트레칭",
          summary: "전신 근육을 이완하는 간단한 10분 스트레칭",
          intensity: "하",
          imageUrl: "",
          videoId: null,
          relatedLink:
            "https://www.youtube.com/results?search_query=스트레칭+운동",
        },
      };
    }
  }

  private async generateContentResult(
    keyword: string,
    englishKeyword: string,
    type: "food" | "exercise"
  ): Promise<{ imageUrl: string; link: string; videoId: string | null }> {
    const searchKeyword =
      type === "exercise" ? `${keyword} 운동법` : `${keyword} 레시피`;

    const defaultLinks = {
      food: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        keyword + " 레시피"
      )}`,
      exercise: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        keyword + " 운동법"
      )}`,
    };

    // YouTube URL에서 Video ID 추출 헬퍼 함수
    const extractVideoId = (url: string): string | null => {
      if (!url) return null;
      const match = url.match(/[?&]v=([^&]+)/);
      return match ? match[1] : null;
    };

    try {
      // 1. YouTube 전용 검색 시도
      this.logger.log(`[Youtube] Searching for: ${searchKeyword}`);
      const ytResult = await this.imageService.searchYoutubeContent(
        searchKeyword
      );

      if (ytResult && ytResult.link && ytResult.imageUrl) {
        this.logger.log(`[Youtube] Found: ${ytResult.link}`);
        const videoId = extractVideoId(ytResult.link);

        // 썸네일을 우리 Supabase Storage에 최적화하여 업로드
        const optimizedImageUrl = await this.imageService.processAndUploadImage(
          ytResult.imageUrl,
          `${type}_yt_${Date.now()}`
        );

        return {
          imageUrl: optimizedImageUrl || ytResult.imageUrl,
          link: ytResult.link,
          videoId: videoId,
        };
      }

      // 2. YouTube 검색 실패 시 Fallback (이미지 + 구글 검색 링크)
      this.logger.warn(`[Youtube] Search failed, falling back for ${keyword}`);

      let imageUrl = "";
      // Fallback: 구글 검색으로 전환
      const fallbackLink = `https://www.google.com/search?q=${encodeURIComponent(
        searchKeyword
      )}`;

      // OG 이미지 또는 Unsplash 이미지로 폴백
      const realUrl = await this.imageService.searchCrawlableUrl(searchKeyword);
      if (realUrl) {
        const ogImageUrl = await this.imageService.fetchOgImage(realUrl);
        if (ogImageUrl) {
          imageUrl =
            (await this.imageService.processAndUploadImage(
              ogImageUrl,
              `${type}_og_${Date.now()}`
            )) || "";
        }
      }

      if (!imageUrl) {
        const unsplashKeyword =
          type === "exercise"
            ? `${englishKeyword} workout`
            : `${englishKeyword} food`;
        const unsplashUrl = await this.imageService.searchUnsplash(
          unsplashKeyword
        );
        if (unsplashUrl) {
          imageUrl =
            (await this.imageService.processAndUploadImage(
              unsplashUrl,
              `${type}_unsplash_${Date.now()}`
            )) || "";
        }
      }

      return { imageUrl, link: fallbackLink, videoId: null };
    } catch (e) {
      this.logger.error(`[Image/Link] Pipeline failed for ${keyword}`, e);
      return { imageUrl: "", link: defaultLinks[type], videoId: null };
    }
  }

  /**
   * 민간요법 전용 콘텐츠 결과 생성 (Google 검색 - 블로그/기사)
   * YouTube 검색을 하지 않고 Google 검색으로 블로그/기사 링크를 찾음
   */
  private async generateRemedyContentResult(
    keyword: string
  ): Promise<{ imageUrl: string; link: string; videoId: string | null }> {
    const searchKeyword = `${keyword} 효능`;
    const fallbackLink = `https://www.google.com/search?q=${encodeURIComponent(
      searchKeyword
    )}`;

    try {
      this.logger.log(`[Remedy] Google searching for: ${searchKeyword}`);

      // 1. Google에서 크롤링 가능한 URL 검색 (블로그/기사)
      const realUrl = await this.imageService.searchCrawlableUrl(searchKeyword);

      if (realUrl) {
        this.logger.log(`[Remedy] Found article: ${realUrl}`);

        // 2. 해당 URL에서 OG 이미지 추출
        const ogImageUrl = await this.imageService.fetchOgImage(realUrl);

        let imageUrl = "";
        if (ogImageUrl) {
          // 이미지 최적화 후 업로드
          imageUrl =
            (await this.imageService.processAndUploadImage(
              ogImageUrl,
              `remedy_og_${Date.now()}`
            )) || "";
          this.logger.log(`[Remedy] OG Image: ${imageUrl || "none"}`);
        }

        return {
          imageUrl,
          link: realUrl, // 블로그/기사 직접 링크
          videoId: null, // YouTube 없음
        };
      }

      // 3. 검색 결과 없으면 Google 검색 링크로 폴백
      this.logger.warn(`[Remedy] No crawlable URL found for: ${keyword}`);
      return {
        imageUrl: "",
        link: fallbackLink,
        videoId: null,
      };
    } catch (e) {
      this.logger.error(`[Remedy] Search failed for ${keyword}`, e);
      return { imageUrl: "", link: fallbackLink, videoId: null };
    }
  }
}
