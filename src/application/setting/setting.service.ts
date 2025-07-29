import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DelayEntity } from './entities/delay.entity';
import { KeywordEntity } from './entities/keyword';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(KeywordEntity)
    private keywordRepository: Repository<KeywordEntity>,
    @InjectRepository(DelayEntity)
    private delayRepository: Repository<DelayEntity>,
  ) { }

  getKeywords(userId: number) {
    return this.keywordRepository.find({
      where: {
        userId
      }
    })
  }

  async getDelay() {
    const response = await this.delayRepository.find()
    return (response.length === 0 ? null : response[0])
  }

  removeAllKeyword() {
    return this.keywordRepository.delete({})
  }

  getKeywordsAdmin() {
    return this.keywordRepository.find({
      where: {
        linkId: IsNull()
      }
    })
  }
}
