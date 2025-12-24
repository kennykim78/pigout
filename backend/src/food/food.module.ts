import { Module } from "@nestjs/common";
import { FoodController } from "./food.controller";
import { FoodService } from "./food.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AiModule } from "../ai/ai.module";
import { OpenDataModule } from "../opendata/opendata.module";
import { ExternalApiClient } from "../ai/utils/external-api.client";
import { UsersModule } from "../users/users.module";
import { ImageModule } from "../image/image.module";

@Module({
  imports: [SupabaseModule, AiModule, OpenDataModule, UsersModule, ImageModule],
  controllers: [FoodController],
  providers: [FoodService, ExternalApiClient],
  exports: [FoodService],
})
export class FoodModule {}
