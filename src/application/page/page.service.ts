import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PageEntity } from "./entities/pages.entity";
import { CreatePageDto } from "./dto/create-page.dto";

@Injectable()
export class PageService {
    constructor(
        @InjectRepository(PageEntity)
        private repo: Repository<PageEntity>,
    ) { }

    getAll() {
        return this.repo.find()
    }

    async create(params: CreatePageDto) {
        const pagesValid = [];
        const pagesInValid = [];

        for (let page of params.pages) {
            if (page.includes('@')) {
                const pageArr = page.split('@')
                page = `${pageArr[1]}:${pageArr[0]}`
            }
            const isExit = (await this.repo.findOne({
                where: {
                    name: page,
                },
            }))
                ? true
                : false;

            if (!isExit) {
                pagesValid.push({
                    name: page,
                });
                continue;
            }

            pagesInValid.push(page);
        }

        await this.repo.save(pagesValid);

        if (pagesInValid.length > 0) {
            throw new HttpException(
                `Thêm thành công ${pagesValid.length}, page bị trùng: [${pagesInValid.join(',')}]`,
                HttpStatus.BAD_REQUEST,
            );
        }
        throw new HttpException(
            `Thêm thành công ${pagesValid.length} page`,
            HttpStatus.OK,
        );
    }

    remove(id: number) {
        return this.repo.delete({ id })
    }
}