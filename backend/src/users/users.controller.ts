import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 기기 등록 또는 조회
   * POST /api/users/register-device
   */
  @Post('register-device')
  async registerDevice(
    @Body('deviceId') bodyDeviceId: string,
    @Headers('x-device-id') headerDeviceId: string
  ) {
    const deviceId = bodyDeviceId || headerDeviceId;

    if (!deviceId) {
      throw new HttpException(
        '기기 ID가 필요합니다.',
        HttpStatus.BAD_REQUEST
      );
    }

    const user = await this.usersService.findOrCreateByDeviceId(deviceId);

    return {
      success: true,
      data: {
        userId: user.id,
        deviceId: user.device_id,
        nickname: user.nickname,
        isVerified: user.is_verified,
        diseases: user.diseases || [],
        createdAt: user.created_at,
      },
      message: '기기가 등록되었습니다.',
    };
  }

  /**
   * 현재 기기의 사용자 정보 조회
   * GET /api/users/me
   */
  @Get('me')
  async getCurrentUser(@Headers('x-device-id') deviceId: string) {
    if (!deviceId) {
      throw new HttpException(
        '기기 ID가 필요합니다.',
        HttpStatus.BAD_REQUEST
      );
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    
    if (!userId) {
      throw new HttpException(
        '등록되지 않은 기기입니다. 먼저 기기를 등록해주세요.',
        HttpStatus.NOT_FOUND
      );
    }

    const user = await this.usersService.findById(userId);

    return {
      success: true,
      data: {
        userId: user.id,
        deviceId: user.device_id,
        nickname: user.nickname,
        email: user.email,
        phone: user.phone,
        isVerified: user.is_verified,
        diseases: user.diseases || [],
        createdAt: user.created_at,
        lastActiveAt: user.last_active_at,
      },
    };
  }

  /**
   * 사용자 프로필 업데이트
   * PATCH /api/users/me
   */
  @Patch('me')
  async updateProfile(
    @Headers('x-device-id') deviceId: string,
    @Body() body: { nickname?: string; diseases?: string[] }
  ) {
    if (!deviceId) {
      throw new HttpException(
        '기기 ID가 필요합니다.',
        HttpStatus.BAD_REQUEST
      );
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    
    if (!userId) {
      throw new HttpException(
        '등록되지 않은 기기입니다.',
        HttpStatus.NOT_FOUND
      );
    }

    const updatedUser = await this.usersService.updateProfile(userId, body);

    return {
      success: true,
      data: {
        userId: updatedUser.id,
        nickname: updatedUser.nickname,
        diseases: updatedUser.diseases,
      },
      message: '프로필이 업데이트되었습니다.',
    };
  }

  /**
   * 분석 히스토리 조회
   * GET /api/users/history
   */
  @Get('history')
  async getHistory(
    @Headers('x-device-id') deviceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (!deviceId) {
      throw new HttpException(
        '기기 ID가 필요합니다.',
        HttpStatus.BAD_REQUEST
      );
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    
    if (!userId) {
      throw new HttpException(
        '등록되지 않은 기기입니다.',
        HttpStatus.NOT_FOUND
      );
    }

    const history = await this.usersService.getAnalysisHistory(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0
    );

    return {
      success: true,
      data: history,
    };
  }

  /**
   * 약물 기록 조회
   * GET /api/users/medicines
   */
  @Get('medicines')
  async getMedicines(
    @Headers('x-device-id') deviceId: string,
    @Query('activeOnly') activeOnly?: string
  ) {
    if (!deviceId) {
      throw new HttpException(
        '기기 ID가 필요합니다.',
        HttpStatus.BAD_REQUEST
      );
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    
    if (!userId) {
      throw new HttpException(
        '등록되지 않은 기기입니다.',
        HttpStatus.NOT_FOUND
      );
    }

    const medicines = await this.usersService.getMedicineRecords(
      userId,
      activeOnly !== 'false'
    );

    return {
      success: true,
      data: medicines,
    };
  }
}
