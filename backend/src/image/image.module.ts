import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseModule } from "../supabase/supabase.module";
import { ImageService } from "./image.service";

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
