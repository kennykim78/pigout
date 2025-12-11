import { Controller, Get, Post, Delete, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { MedicineService } from './medicine.service';
import { SearchMedicineDto } from './dtos/search-medicine.dto';
import { AnalyzeInteractionDto } from './dtos/analyze-interaction.dto';
import { AnalyzeAllMedicinesDto } from './dtos/analyze-all-medicines.dto';
import { AnalyzeMedicineImageDto } from './dtos/analyze-image.dto';
import { UsersService } from '../users/users.service';

@Controller('medicine')
export class MedicineController {
  constructor(
    private readonly medicineService: MedicineService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 기기 ID로 사용자 ID 조회 (없으면 자동 생성)
   */
  private async getUserIdFromDeviceId(deviceId?: string): Promise<string> {
    if (!deviceId) {
      return '00000000-0000-0000-0000-000000000000';
    }
    
    const foundUserId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (foundUserId) {
      return foundUserId;
    }
    
    // 기기가 등록되지 않은 경우 자동 등록
    const newUser = await this.usersService.findOrCreateByDeviceId(deviceId);
    return newUser.id;
  }

  /**
   * POST /api/medicine/search
   * 약품명으로 검색 (일반/전문 의약품)
   */
  @Post('search')
  async searchMedicine(@Body() searchDto: SearchMedicineDto) {
    return this.medicineService.searchMedicine(searchDto.keyword, searchDto.limit || 1000);
  }

  /**
   * POST /api/medicine/search-health-food
   * 건강기능식품 전용 검색
   */
  @Post('search-health-food')
  async searchHealthFood(@Body() searchDto: SearchMedicineDto) {
    return this.medicineService.searchHealthFood(searchDto.keyword, searchDto.limit || 1000);
  }

  /**
   * POST /api/medicine/analyze-image
   * 이미지에서 약품 정보 추출 (AI 분석)
   * QR 코드 대신 카메라로 약 봉지/알약 촬영하여 약품명 인식
   */
  @Post('analyze-image')
  async analyzeImage(@Body() analyzeDto: AnalyzeMedicineImageDto) {
    return this.medicineService.analyzeMedicineImage(
      analyzeDto.imageBase64,
      analyzeDto.mimeType || 'image/jpeg',
    );
  }

  /**
   * POST /api/medicine/add
   * 검색한 약품 직접 등록
   */
  @Post('add')
  async addMedicine(
    @Headers('x-device-id') deviceId: string,
    @Body() medicineData: any,
  ) {
    const userId = await this.getUserIdFromDeviceId(deviceId);
    console.log(`[Medicine] addMedicine - deviceId: ${deviceId}, userId: ${userId}`);
    return this.medicineService.addMedicineFromSearch(userId, medicineData);
  }

  /**
   * GET /api/medicine/my-list
   * 복용중인 약 목록 조회
   */
  @Get('my-list')
  async getMyMedicines(
    @Headers('x-device-id') deviceId: string,
    @Query('active') active?: string,
  ) {
    const userId = await this.getUserIdFromDeviceId(deviceId);
    console.log(`[Medicine] getMyMedicines - deviceId: ${deviceId}, userId: ${userId}`);
    const activeOnly = active !== 'false';
    return this.medicineService.getMyMedicines(userId, activeOnly);
  }

  /**
   * POST /api/medicine/analyze-interaction
   * 약-음식 상호작용 분석
   */
  @Post('analyze-interaction')
  async analyzeInteraction(@Body() analyzeDto: AnalyzeInteractionDto) {
    return this.medicineService.analyzeInteraction(
      analyzeDto.medicineIds,
      analyzeDto.foodName,
    );
  }

  /**
   * POST /api/medicine/analyze-all
   * 복용 중인 모든 약물 상관관계 종합 분석
   */
  @Post('analyze-all')
  async analyzeAllMedicines(
    @Headers('x-device-id') deviceId: string,
    @Body() analyzeDto: AnalyzeAllMedicinesDto,
  ) {
    const userId = await this.getUserIdFromDeviceId(deviceId);
    console.log(`[Medicine] analyzeAllMedicines - deviceId: ${deviceId}, userId: ${userId}`);
    return this.medicineService.analyzeAllMedicineInteractions(userId);
  }

  /**
   * PATCH /api/medicine/:id
   * 약 복용 기록 수정
   */
  @Patch(':id')
  async updateMedicine(
    @Headers('x-device-id') deviceId: string,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const userId = await this.getUserIdFromDeviceId(deviceId);
    console.log(`[Medicine] updateMedicine - deviceId: ${deviceId}, userId: ${userId}`);
    return this.medicineService.updateMedicineRecord(userId, id, updates);
  }

  /**
   * DELETE /api/medicine/:id
   * 약 복용 기록 삭제
   */
  @Delete(':id')
  async deleteMedicine(
    @Headers('x-device-id') deviceId: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromDeviceId(deviceId);
    console.log(`[Medicine] deleteMedicine - deviceId: ${deviceId}, userId: ${userId}`);
    return this.medicineService.deleteMedicineRecord(userId, id);
  }
}
