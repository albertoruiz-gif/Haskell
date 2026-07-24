import { Module } from '@nestjs/common';
import { CulqiService } from './culqi.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  providers: [CulqiService],
  exports: [CulqiService],
})
export class PaymentsModule {}
