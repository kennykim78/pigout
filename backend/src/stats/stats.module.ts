import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { RewardModule } from '../reward/reward.module';

@Module({
  imports: [SupabaseModule, RewardModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
