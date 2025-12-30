import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { GeminiClient } from "../ai/utils/gemini.client";
import axios from "axios";
import sharp from "sharp";

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private geminiClient: GeminiClient;
  private readonly unsplashAccessKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService
  ) {
    const geminiApiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (geminiApiKey) {
      this.geminiClient = new GeminiClient(geminiApiKey);
    }
    this.unsplashAccessKey = this.configService.get<string>(
      "UNSPLASH_ACCESS_KEY"
    );
  }

  /**
   * Google Translate (Gemini)를 사용하여 한글 -> 영어 변환
   */
  async translateToEnglish(text: string): Promise<string> {
    try {
      if (!this.geminiClient) return text;
      // Gemini Flash 모델을 사용하여 빠르고 저렴하게 번역
      // TODO: geminiClient에 translate 메소드가 없다면 직접 구현하거나 textModel 사용
      // 여기서는 직접 textModel을 호출하는 로직을 가정하거나, geminiClient에 추가해야 함.
      // gemini.client.ts를 수정하는 대신, 여기서 직접 textModel에 접근할 수 없으므로(private),
      // geminiClient에 public method를 추가하거나,
      // 간단히 여기서 axios로 Gemini API를 호출하거나...
      // 가장 깔끔한 건 User가 GeminiClient를 이미 가지고 있으므로,
      // GeminiClient에 translate 메소드를 추가하는 것이 좋음.
      // 일단은 임시로 GeminiClient에 메소드가 있다고 가정하고, 없으면 task_boundary 단계에서 추가.

      // 하지만 GeminiClient 변경 없이 구현하려면:
      // GeminiClient.generateHealthFoodInfo 처럼 textModel을 사용하는 메소드가 필요.
      // 여기서는 GeminiClient.generateText(prompt) 같은 범용 메소드가 있다면 좋겠지만 없음.
      // 따라서 GeminiClient에 'translateToEnglish' 메소드를 추가하는 것이 가장 좋음.

      return await this.geminiClient.translateText(text); // 이 메소드를 추가해야 함
    } catch (error) {
      this.logger.warn(`Translation failed for ${text}: ${error.message}`);
      return text; // 실패 시 원본
    }
  }

  /**
   * Google Custom Search로 실제 콘텐츠(블로그/유튜브) URL 찾기
   */
  async searchCrawlableUrl(keyword: string): Promise<string | null> {
    const apiKey = this.configService.get<string>("GOOGLE_SEARCH_API_KEY");
    const cx = this.configService.get<string>("GOOGLE_SEARCH_CX");

    if (!apiKey || !cx) {
      this.logger.warn("Google Search API Key or CX is missing");
      return null;
    }

    try {
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: apiKey,
            cx: cx,
            q: keyword,
            num: 1, // 최상위 결과 1개만
          },
        }
      );

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].link;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Google Search failed for ${keyword}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * YouTube에서 관련 영상 검색 및 썸네일/링크 반환
   */
  async searchYoutubeContent(
    keyword: string
  ): Promise<{ link: string; imageUrl: string } | null> {
    const apiKey = this.configService.get<string>("GOOGLE_SEARCH_API_KEY");
    const cx = this.configService.get<string>("GOOGLE_SEARCH_CX");

    if (!apiKey || !cx) {
      this.logger.warn("Google Search API Key or CX is missing for Youtube");
      return null;
    }

    try {
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: apiKey,
            cx: cx,
            q: `site:youtube.com ${keyword}`,
            num: 1,
          },
        }
      );

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        const link = item.link;
        let imageUrl = "";

        // 1. CSE 메타데이터에서 썸네일 추출 시도
        if (item.pagemap?.cse_image?.[0]?.src) {
          imageUrl = item.pagemap.cse_image[0].src;
        } else if (item.pagemap?.cse_thumbnail?.[0]?.src) {
          imageUrl = item.pagemap.cse_thumbnail[0].src;
        }

        // 2. 실패 시 URL에서 Video ID 추출하여 직접 생성
        if (!imageUrl && link.includes("watch?v=")) {
          const videoId = link.split("v=")[1]?.split("&")[0];
          if (videoId) {
            imageUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
          }
        }

        return { link, imageUrl };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Youtube Search failed for ${keyword}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * URL에서 OG 이미지 추출
   */
  async fetchOgImage(url: string): Promise<string | null> {
    try {
      const ogs = await import("open-graph-scraper");
      const { result } = await ogs.default({ url });

      if (result.ogImage && result.ogImage.length > 0) {
        // 이미지가 배열인 경우 첫 번째 이미지 URL 반환
        return result.ogImage[0].url;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `OG Image extraction failed for ${url}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Unsplash에서 이미지 검색 및 URL 반환
   */
  async searchUnsplash(keyword: string): Promise<string | null> {
    if (!this.unsplashAccessKey) {
      this.logger.warn("Unsplash API Key is missing");
      return null;
    }

    try {
      const response = await axios.get(
        "https://api.unsplash.com/search/photos",
        {
          params: {
            query: keyword,
            per_page: 1,
            orientation: "landscape", // 가로 사진 선호
          },
          headers: {
            Authorization: `Client-ID ${this.unsplashAccessKey}`,
          },
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].urls.regular; // 적당한 크기 URL
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Unsplash search failed for ${keyword}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * 음식 이름으로 이미지 URL 검색 (Google Custom Search + Unsplash Fallback)
   */
  async searchImageToUrl(foodName: string): Promise<string | null> {
    try {
      // 1. 우선 Unsplash에서 검색 (번역 후)
      const englishKeyword = await this.translateToEnglish(foodName + " food");
      const unsplashResult = await this.searchUnsplash(englishKeyword);
      if (unsplashResult) {
        return unsplashResult;
      }

      // 2. Google Custom Search 이미지 검색 폴백
      const googleApiKey = this.configService.get<string>(
        "GOOGLE_SEARCH_API_KEY"
      );
      const googleCx = this.configService.get<string>("GOOGLE_SEARCH_CX");

      if (googleApiKey && googleCx) {
        const response = await axios.get(
          "https://www.googleapis.com/customsearch/v1",
          {
            params: {
              key: googleApiKey,
              cx: googleCx,
              q: foodName,
              searchType: "image",
              num: 1,
              safe: "high",
            },
          }
        );

        if (response.data.items && response.data.items.length > 0) {
          return response.data.items[0].link;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Image search failed for ${foodName}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * 이미지 다운로드, 리사이징, 압축 (<50KB), Supabase 업로드
   * @returns Supabase Public URL
   */
  async processAndUploadImage(
    imageUrl: string,
    fileName: string
  ): Promise<string | null> {
    try {
      // imageUrl이 상대 경로인 경우 처리 (드문 경우)
      if (imageUrl.startsWith("/")) {
        this.logger.warn(`Skipping relative imageUrl: ${imageUrl}`);
        return null;
      }

      // 1. Download
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      const buffer = Buffer.from(response.data, "binary");

      // 2. Refresh & Compress via Sharp
      // 사용자의 요청대로 600px, 50KB 이하 목표로 압축
      let quality = 60;
      let compressedBuffer = await sharp(buffer)
        .resize({
          width: 600,
          height: 400,
          fit: "cover",
          position: "center",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();

      // 용량 체크 및 재압축 (50KB = 51200 bytes)
      while (compressedBuffer.length > 51200 && quality > 10) {
        quality -= 10;
        this.logger.warn(
          `Image size ${(compressedBuffer.length / 1024).toFixed(
            1
          )}KB > 50KB. Retrying with quality ${quality}`
        );
        compressedBuffer = await sharp(buffer)
          .resize({
            width: 600,
            height: 400,
            fit: "cover",
            position: "center",
            withoutEnlargement: true,
          })
          .webp({ quality })
          .toBuffer();
      }

      // 3. Upload to Supabase
      const path = `daily_images/${fileName}_${Date.now()}.webp`;
      const client = this.supabaseService.getClient();

      const { data, error } = await client.storage
        .from("daily_images")
        .upload(path, compressedBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (error) {
        this.logger.error(`Supabase upload failed: ${error.message}`);
        return null;
      }

      // 4. Get Public URL
      const { data: publicUrlData } = client.storage
        .from("daily_images")
        .getPublicUrl(path);

      return publicUrlData.publicUrl;
    } catch (error) {
      this.logger.error(`Image processing failed: ${error.message}`);
      return null;
    }
  }
}
