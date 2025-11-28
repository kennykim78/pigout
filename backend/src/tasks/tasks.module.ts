import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { FoodModule } from '../food/food.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [FoodModule, SupabaseModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
