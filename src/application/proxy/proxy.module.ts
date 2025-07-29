import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyEntity } from './entities/proxy.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ProxyEntity])],
  exports: [ProxyService],
  controllers: [],
  providers: [ProxyService],
})
export class ProxyModule { }
