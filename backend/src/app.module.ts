import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FoodModule } from './food/food.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AiModule } from './ai/ai.module';
import { RewardModule } from './reward/reward.module';
import { MedicineModule } from './medicine/medicine.module';
import { StatsModule } from './stats/stats.module';
import { OpenDataModule } from './opendata/opendata.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    OpenDataModule,
    FoodModule,
    AiModule,
    RewardModule,
    MedicineModule,
    StatsModule,
  ],
})
export class AppModule {}
