import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FoodModule } from './food/food.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AiModule } from './ai/ai.module';
import { RewardModule } from './reward/reward.module';
import { MedicineModule } from './medicine/medicine.module';
import { StatsModule } from './stats/stats.module';
import { OpenDataModule } from './opendata/opendata.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    OpenDataModule,
    UsersModule,
    FoodModule,
    AiModule,
    RewardModule,
    MedicineModule,
    StatsModule,
    TasksModule,
  ],
})
export class AppModule {}
