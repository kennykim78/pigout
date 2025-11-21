import { Module } from '@nestjs/common';
import { OpenDataService } from './opendata.service';
import { OpenDataController } from './opendata.controller';

@Module({
  controllers: [OpenDataController],
  providers: [OpenDataService],
  exports: [OpenDataService],
})
export class OpenDataModule {}
