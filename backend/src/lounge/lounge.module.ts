import { Module } from "@nestjs/common";
import { LoungeController } from "./lounge.controller";
import { LoungeService } from "./lounge.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [SupabaseModule, UsersModule],
  controllers: [LoungeController],
  providers: [LoungeService],
})
export class LoungeModule {}
