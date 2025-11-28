import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FoodService } from '../food/food.service';
import { SupabaseService } from '../supabase/supabase.service';
import { generatePrewarmCombinations } from '../food/prewarm-data';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private isPrewarmRunning = false;

  constructor(
    private readonly foodService: FoodService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * 매월 1일 새벽 3시 (한국 시간 기준)에 인기 음식 사전 캐싱 실행
   * UTC 기준으로 18시 = KST 03시
   * Cron: 분 시 일 월 요일 → 0 18 1 * * = 매월 1일 18:00 UTC (KST 03:00)
   */
  @Cron('0 18 1 * *', {
    name: 'prewarm-cache',
    timeZone: 'UTC',
  })
  async handlePrewarmCron() {
    this.logger.log('🚀 [스케줄러] 월간 인기 음식 사전 캐싱 시작 (매월 1일 KST 03:00)');
    await this.runPrewarm();
  }

  /**
   * 매월 1일 새벽 4시 (한국 시간 기준)에 만료된 캐시 정리
   * UTC 기준으로 19시 = KST 04시
   * 사전 캐싱(03시) 완료 후 1시간 뒤 실행
   */
  @Cron('0 19 1 * *', {
    name: 'cleanup-cache',
    timeZone: 'UTC',
  })
  async handleCleanupCron() {
    this.logger.log('🧹 [스케줄러] 월간 만료 캐시 정리 시작 (매월 1일 KST 04:00)');
    
    try {
      const client = this.supabaseService.getClient();
      const { error } = await client.rpc('cleanup_expired_cache');
      
      if (error) {
        this.logger.error('캐시 정리 실패:', error.message);
      } else {
        this.logger.log('✅ 만료된 캐시 정리 완료');
      }
    } catch (error) {
      this.logger.error('캐시 정리 중 오류:', error.message);
    }
  }

  /**
   * 사전 캐싱 실행 (수동 호출 가능)
   */
  async runPrewarm(batchSize: number = 5): Promise<{
    success: boolean;
    processed: number;
    cached: number;
    skipped: number;
    errors: number;
  }> {
    if (this.isPrewarmRunning) {
      this.logger.warn('⚠️ 사전 캐싱이 이미 실행 중입니다.');
      return { success: false, processed: 0, cached: 0, skipped: 0, errors: 0 };
    }

    this.isPrewarmRunning = true;
    const combinations = generatePrewarmCombinations();
    let processed = 0;
    let cached = 0;
    let skipped = 0;
    let errors = 0;

    this.logger.log(`📊 총 ${combinations.length}개 조합 사전 캐싱 시작`);

    try {
      for (let i = 0; i < combinations.length; i += batchSize) {
        const batch = combinations.slice(i, i + batchSize);
        
        for (const combo of batch) {
          try {
            // 캐시에 이미 있는지 확인
            const cacheKey = this.supabaseService.generateCacheKey(
              combo.foodName,
              combo.diseases,
              [],
            );
            const existing = await this.supabaseService.getCachedAnalysis(cacheKey);
            
            if (existing) {
              skipped++;
              processed++;
              continue;
            }
            
            // 캐시 없으면 분석 수행
            await this.foodService.simpleAnalyzeFoodByText(
              combo.foodName,
              combo.diseases,
            );
            cached++;
            processed++;
            
            this.logger.debug(`✅ 캐싱: ${combo.foodName} (${combo.diseases.join(', ') || '질병없음'})`);
          } catch (error) {
            errors++;
            processed++;
            this.logger.warn(`❌ 실패: ${combo.foodName} - ${error.message}`);
          }
        }
        
        // 배치 간 1초 대기 (Rate limiting)
        if (i + batchSize < combinations.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 진행률 로깅 (25% 단위)
        const progress = Math.floor((processed / combinations.length) * 100);
        if (progress % 25 === 0 && progress > 0) {
          this.logger.log(`📈 진행률: ${progress}% (${processed}/${combinations.length})`);
        }
      }

      this.logger.log(`✅ 사전 캐싱 완료: 캐싱 ${cached}개, 스킵 ${skipped}개, 에러 ${errors}개`);
      
      return { success: true, processed, cached, skipped, errors };
    } finally {
      this.isPrewarmRunning = false;
    }
  }

  /**
   * 사전 캐싱 상태 확인
   */
  getPrewarmStatus(): { isRunning: boolean } {
    return { isRunning: this.isPrewarmRunning };
  }
}
