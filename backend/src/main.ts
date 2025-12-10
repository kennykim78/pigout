import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('[BOOT] Starting Nest application bootstrap...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
      bodyParser: true,
    });
    console.log('[BOOT] NestFactory.create completed');

    // 🔥 Request body 크기 제한 (이미지 업로드 대응)
    // AI 분석용 압축 이미지: ~100KB (최대 200KB까지 여유)
    app.use(require('express').json({ limit: '500kb' }));
    app.use(require('express').urlencoded({ limit: '500kb', extended: true }));
    console.log('[BOOT] Body parser limits set to 500kb');

    // CORS 설정 - 여러 환경 지원
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
          return callback(null, true);
        }
        // Allow all vercel.app domains for preview deployments
        if (origin.includes('.vercel.app')) {
          return callback(null, true);
        }
        callback(null, false);
      },
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
