import { Module } from "@nestjs/common";
import { RecommendationController } from "./recommendation.controller";
import { RecommendationService } from "./recommendation.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { ConfigModule } from "@nestjs/config";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [SupabaseModule, ConfigModule, UsersModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
