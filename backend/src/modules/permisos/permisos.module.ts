import { Global, Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';

// Global: RolesGuard se usa tanto como APP_GUARD (root) como vía
// @UseGuards(RolesGuard) directo en ~15 controllers de otros módulos — para
// que la inyección de PermisosService funcione en todos esos contextos sin
// tener que importar PermisosModule en cada uno, el módulo se declara
// global (mismo patrón que ConfigModule con PrismaService).
@Global()
@Module({
  controllers: [PermisosController],
  providers: [PermisosService],
  exports: [PermisosService],
})
export class PermisosModule {}
