import { Module } from '@nestjs/common';
import { MedicineService } from './medicine.service';
import { MedicineController } from './medicine.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SupabaseModule, AiModule, UsersModule],
  controllers: [MedicineController],
  providers: [MedicineService],
  exports: [MedicineService],
})
export class MedicineModule {}
