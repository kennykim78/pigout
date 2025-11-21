import { Module } from '@nestjs/common';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AiModule } from '../ai/ai.module';
import { OpenDataModule } from '../opendata/opendata.module';
import { ExternalApiClient } from '../ai/utils/external-api.client';

@Module({
  imports: [SupabaseModule, AiModule, OpenDataModule],
  controllers: [FoodController],
  providers: [FoodService, ExternalApiClient],
  exports: [FoodService],
})
export class FoodModule {}
