import { Module } from "@nestjs/common";
import { RecommendationController } from "./recommendation.controller";
import { RecommendationService } from "./recommendation.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { ConfigModule } from "@nestjs/config";
import { UsersModule } from "../users/users.module";
import { ImageModule } from "../image/image.module";

@Module({
  imports: [SupabaseModule, ConfigModule, UsersModule, ImageModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
