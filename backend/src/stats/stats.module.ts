import { Module } from "@nestjs/common";
import { StatsService } from "./stats.service";
import { StatsController } from "./stats.controller";
import { SupabaseModule } from "../supabase/supabase.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [SupabaseModule, UsersModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
