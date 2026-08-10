import { Module } from '@nestjs/common';
import { LibroReclamacionesController } from './libro-reclamaciones.controller';
import { LibroReclamacionesService } from './libro-reclamaciones.service';

@Module({
  controllers: [LibroReclamacionesController],
  providers: [LibroReclamacionesService],
})
export class LibroReclamacionesModule {}
