import { Module } from '@nestjs/common';
import { CulqiService } from './culqi.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [CulqiService],
  exports: [CulqiService],
})
export class PaymentsModule {}
