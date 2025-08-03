import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PageService } from "./page.service";
import { PageEntity } from "./entities/pages.entity";

@Module({
    imports: [TypeOrmModule.forFeature([PageEntity])],
    controllers: [],
    providers: [PageService],
    exports: [PageService],
})
export class PageModule { }
