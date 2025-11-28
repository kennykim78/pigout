import { Controller, Post, Get } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * 사전 캐싱 수동 실행
   * POST /api/tasks/prewarm/start
   */
  @Post('prewarm/start')
  async startPrewarm() {
    const status = this.tasksService.getPrewarmStatus();
    
    if (status.isRunning) {
      return {
        success: false,
        message: '사전 캐싱이 이미 실행 중입니다.',
        data: status,
      };
    }

    // 비동기로 실행 (즉시 응답)
    this.tasksService.runPrewarm().catch(err => {
      console.error('사전 캐싱 오류:', err);
    });

    return {
      success: true,
      message: '사전 캐싱이 시작되었습니다. 백그라운드에서 실행됩니다.',
      data: { isRunning: true },
    };
  }

  /**
   * 사전 캐싱 상태 확인
   * GET /api/tasks/prewarm/status
   */
  @Get('prewarm/status')
  async getPrewarmStatus() {
    const status = this.tasksService.getPrewarmStatus();
    return {
      success: true,
      data: status,
      message: status.isRunning ? '사전 캐싱 실행 중' : '대기 중',
    };
  }

  /**
   * 캐시 정리 수동 실행
   * POST /api/tasks/cleanup
   */
  @Post('cleanup')
  async runCleanup() {
    await this.tasksService.handleCleanupCron();
    return {
      success: true,
      message: '만료된 캐시 정리 완료',
    };
  }
}
