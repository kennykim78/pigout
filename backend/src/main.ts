import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('[BOOT] Starting Nest application bootstrap...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    console.log('[BOOT] NestFactory.create completed');

    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    });
    console.log('[BOOT] CORS enabled');

    app.setGlobalPrefix('api');
    console.log('[BOOT] Global prefix set to /api');

    const port = parseInt(process.env.PORT || '3001', 10);
    console.log(`[BOOT] Attempting to listen on port ${port} ...`);
    await app.listen(port, '0.0.0.0');
    console.log('[BOOT] app.listen resolved');
    
    console.log(`✅ Server successfully started`);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📡 API endpoints: http://localhost:${port}/api`);

    // Heartbeat to verify process remains alive and port presumably open
    setInterval(() => {
      process.stdout.write(`[HEARTBEAT] ${new Date().toISOString()} PID=${process.pid}\n`);
    }, 5000);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
}

bootstrap().catch(err => {
  console.error('💥 Bootstrap fatal error:', err);
  process.exit(1);
});
