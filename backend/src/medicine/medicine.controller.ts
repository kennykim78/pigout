import { Controller, Get, Post, Delete, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { MedicineService } from './medicine.service';
import { ScanQrDto } from './dtos/scan-qr.dto';
import { SearchMedicineDto } from './dtos/search-medicine.dto';
import { AnalyzeInteractionDto } from './dtos/analyze-interaction.dto';

@Controller('medicine')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  /**
   * POST /api/medicine/scan-qr
   * QR 코드 스캔하여 약 정보 저장
   */
  @Post('scan-qr')
  async scanQr(@Req() req: any, @Body() scanDto: ScanQrDto) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicineService.scanQrCode(
      userId,
      scanDto.qrData,
      scanDto.dosage,
      scanDto.frequency,
    );
  }

  /**
   * POST /api/medicine/search
   * 약품명으로 검색
   */
  @Post('search')
  async searchMedicine(@Body() searchDto: SearchMedicineDto) {
    return this.medicineService.searchMedicine(searchDto.keyword);
  }

  /**
   * POST /api/medicine/add
   * 검색한 약품 직접 등록
   */
  @Post('add')
  async addMedicine(@Req() req: any, @Body() medicineData: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicineService.addMedicineFromSearch(
      userId,
      medicineData.itemName,
      medicineData.entpName,
      medicineData.itemSeq,
      medicineData.efcyQesitm,
      medicineData.dosage,
      medicineData.frequency,
    );
  }

  /**
   * GET /api/medicine/my-list
   * 복용중인 약 목록 조회
   */
  @Get('my-list')
  async getMyMedicines(@Req() req: any, @Query('active') active?: string) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
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
   * PATCH /api/medicine/:id
   * 약 복용 기록 수정
   */
  @Patch(':id')
  async updateMedicine(@Req() req: any, @Param('id') id: string, @Body() updates: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicineService.updateMedicineRecord(userId, id, updates);
  }

  /**
   * DELETE /api/medicine/:id
   * 약 복용 기록 삭제
   */
  @Delete(':id')
  async deleteMedicine(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.medicineService.deleteMedicineRecord(userId, id);
  }
}
