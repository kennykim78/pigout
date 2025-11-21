import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    });

    app.setGlobalPrefix('api');

    const port = parseInt(process.env.PORT) || 3001;
    await app.listen(port, '0.0.0.0');
    
    console.log(`✅ Server successfully started`);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📡 API endpoints: http://localhost:${port}/api`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
}

bootstrap().catch(err => {
  console.error('💥 Bootstrap fatal error:', err);
  process.exit(1);
});
