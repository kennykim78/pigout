import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FoodModule } from "./food/food.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { AiModule } from "./ai/ai.module";
import { RecommendationModule } from "./recommendation/recommendation.module";
import { MedicineModule } from "./medicine/medicine.module";
import { StatsModule } from "./stats/stats.module";
import { OpenDataModule } from "./opendata/opendata.module";
import { UsersModule } from "./users/users.module";
import { ImageModule } from "./image/image.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    SupabaseModule,
    OpenDataModule,
    UsersModule,
    FoodModule,
    AiModule,
    RecommendationModule, // Replaces RewardModule
    MedicineModule,
    StatsModule,
    ImageModule,
  ],
})
export class AppModule {}
