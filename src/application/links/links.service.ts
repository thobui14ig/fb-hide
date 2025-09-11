import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';
import { In, IsNull, MoreThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { LEVEL } from '../user/entities/user.entity';
import { UpdateLinkDTO } from './dto/update-link.dto';
import { HideBy, LinkEntity, LinkStatus, LinkType } from './entities/links.entity';
import { ISettingLinkDto } from './links.service.i';
import { CookieStatus } from '../cookie/entities/cookie.entity';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class LinkService {
  ukTimezone = 'Asia/Ho_Chi_Minh';
  constructor(
    @InjectRepository(LinkEntity)
    private repo: Repository<LinkEntity>,
  ) { }

  getOne(id: number) {
    return this.repo.findOne({
      where: {
        id,
      },
    });
  }

  update(params: UpdateLinkDTO, level: LEVEL) {
    const argUpdate: Partial<LinkEntity> = {};
    argUpdate.id = params.id;
    argUpdate.linkName = params.linkName;
    argUpdate.hideCmt = params.hideCmt;

    if (level === LEVEL.ADMIN) {
      argUpdate.delayTime = params.delayTime;
      argUpdate.type = params.type;
    }

    return this.repo.save(argUpdate);
  }

  async hideCmt(linkId: number, type: HideBy, userId: number) {
    const link = await this.repo.findOne({
      where: {
        id: linkId
      }
    })
    if (link) {
      link.hideBy = type
      return this.repo.save(link)
    }

    return null
  }

  getkeywordsByLink(linkId: number) {
    return this.repo.findOne({
      where: {
        id: linkId
      },
      relations: {
        keywords: true
      }
    })
  }

  async settingLink(setting: ISettingLinkDto) {
    if (setting.isDelete) {
      return this.repo.delete(setting.linkIds)
    }

    const links = await this.repo.find({
      where: {
        id: In(setting.linkIds)
      }
    })

    const newLinks = links.map((item) => {
      if (setting.onOff) {
        item.status = LinkStatus.Started
      } else {
        item.status = LinkStatus.Pending
      }

      if (setting.delay) {
        item.delayTime = setting.delay
      }

      return item
    })

    return this.repo.save(newLinks)
  }

  async updateLinkPostIdInvalid(postId: string) {
    const links = await this.repo.find({
      where: {
        postId,
      }
    })

    return this.repo.save(links.map((item) => {
      return {
        ...item,
        errorMessage: `Link die`,
        type: LinkType.DIE
      }
    }))
  }

  getLinkOrtherId(postId: string) {
    return this.repo.findOne({
      where: {
        postId: Not(postId),
        type: LinkType.PRIVATE
      }
    })
  }

  updateType(link: LinkEntity) {
    return this.repo.save(link)
  }

  getLinksWithoutProfile() {
    return this.repo.find({
      where: {
        process: false,
        postId: IsNull()
      },
      select: {
        linkUrl: true,
        id: true,
        postId: true,
        userId: true
      }
    })
  }

  getPostStarted(): Promise<LinkEntity[]> {
    return this.repo.find({
      where: {
        status: In([LinkStatus.Started, LinkStatus.Pending]),
        type: Not(LinkType.DIE),
        delayTime: MoreThanOrEqual(0),
        hideCmt: true,
        isDelete: false
      },
      relations: {
        page: {
          cookies: true
        }
      }
    })
  }
}
