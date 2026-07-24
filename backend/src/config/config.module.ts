import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { SecretsService } from './secrets.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true })],
  providers: [SecretsService, PrismaService],
  exports: [SecretsService, PrismaService],
})
export class ConfigModule {}
