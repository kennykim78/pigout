import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ExternalApiClient } from './utils/external-api.client';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [AiController],
  providers: [AiService, ExternalApiClient],
  exports: [AiService, ExternalApiClient],
})
export class AiModule {}
