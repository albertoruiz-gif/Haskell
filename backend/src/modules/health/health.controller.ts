import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

// Usado por readiness/liveness probes de Kubernetes (infra/k8s/backend-deployment.yaml)
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
