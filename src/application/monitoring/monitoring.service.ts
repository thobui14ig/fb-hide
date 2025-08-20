import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { isNumeric } from 'src/common/utils/check-utils';
import { delay, getHttpAgent, groupPostsByType } from 'src/common/utils/helper';
import { In, IsNull, Not, Repository } from 'typeorm';
import { CommentsService } from '../comments/comments.service';
import { CommentEntity } from '../comments/entities/comment.entity';
import { CookieService } from '../cookie/cookie.service';
import { FacebookService } from '../facebook/facebook.service';
import { GetUuidUserUseCase } from '../facebook/usecase/get-uuid-user/get-uuid-user';
import {
  LinkEntity,
  LinkStatus,
  LinkType
} from '../links/entities/links.entity';
import { LinkService } from '../links/links.service';
import { ProxyEntity, ProxyStatus } from '../proxy/entities/proxy.entity';
import { ProxyService } from '../proxy/proxy.service';
import { DelayEntity } from '../setting/entities/delay.entity';
import { SettingService } from '../setting/setting.service';
import { TokenService } from '../token/token.service';
import { UserEntity } from '../user/entities/user.entity';
import { RedisService } from 'src/infra/redis/redis.service';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
const proxy_check = require('proxy-check');

dayjs.extend(utc);

type RefreshKey = 'refreshToken' | 'refreshCookie' | 'refreshProxy';
@Injectable()
export class MonitoringService {
  postIdRunning: string[] = []
  linksPublic: LinkEntity[] = []
  linksPrivate: LinkEntity[] = []
  isHandleUrl: boolean = false
  isReHandleUrl: boolean = false
  isHandleUuid: boolean = false
  isCheckProxy: boolean = false

  constructor(
    @InjectRepository(LinkEntity)
    private linkRepository: Repository<LinkEntity>,
    @InjectRepository(CommentEntity)
    private commentRepository: Repository<CommentEntity>,
    private readonly facebookService: FacebookService,
    @InjectRepository(DelayEntity)
    private delayRepository: Repository<DelayEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private getUuidUserUseCase: GetUuidUserUseCase,
    private settingService: SettingService,
    private linkService: LinkService,
    private commentService: CommentsService,
  ) {
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async startMonitoring() {
    const postsStarted = await this.linkService.getPostStarted()
    const groupPost = groupPostsByType(postsStarted || []);
    for (const element of postsStarted) {
      const itemPublic = this.linksPublic.find(item => item.id === element.id)
      if (itemPublic) {
        itemPublic.delayTime = element.delayTime
      }

      const itemPrivate = this.linksPrivate.find(item => item.id === element.id)
      if (itemPrivate) {
        itemPrivate.delayTime = element.delayTime
      }
    }

    return Promise.all([this.handleStartMonitoring((groupPost.public || []), LinkType.PUBLIC), this.handleStartMonitoring((groupPost.private || []), LinkType.PRIVATE)])
  }

  handleStartMonitoring(links: LinkEntity[], type: LinkType) {
    let oldLinksRunning = []
    if (type === LinkType.PUBLIC) {
      oldLinksRunning = this.linksPublic
    } else {
      oldLinksRunning = this.linksPrivate
    }


    const oldIdsSet = new Set(oldLinksRunning.map(item => item.id));
    const linksRunning = links.filter(item => !oldIdsSet.has(item.id));

    if (type === LinkType.PUBLIC) {
      this.linksPublic = links
      return this.handlePostsPublic(linksRunning)
    }
    else {
      this.linksPrivate = links
      return this.handlePostsPrivate(linksRunning)
    }
  }

  async processLinkPublic1(link: LinkEntity) {
    if (!link.postIdV1) {
      const runThread = async (threadOrder: number) => {
        while (true) {
          const linkRuning = this.linksPublic.find(item => item.id === link.id)// check còn nằm trong link
          if (!linkRuning) { break };
          if (threadOrder > linkRuning.thread) { break };

          try {
            let res = await this.facebookService.getCmtPublic(link.postId, link)

            if (!res?.commentId || !res?.userIdComment) continue;
            const commentEntities: CommentEntity[] = []
            const linkEntities: Partial<LinkEntity>[] = []
            const {
              commentId,
              commentMessage,
              phoneNumber,
              userIdComment,
              userNameComment,
              commentCreatedAt,
            } = res
            let isSave = await this.checkIsSave(commentMessage)

            if (isSave) {
              const uid = (isNumeric(userIdComment) ? userIdComment : (await this.getUuidUserUseCase.getUuidUser(userIdComment)) || userIdComment)
              let newPhone = phoneNumber
              const commentEntity: Partial<CommentEntity> = {
                cmtId: commentId,
                linkId: link.id,
                postId: link.postId,
                userId: link.userId,
                uid,
                message: commentMessage,
                phoneNumber: newPhone,
                name: userNameComment,
                timeCreated: commentCreatedAt as any,
              }
              commentEntities.push(commentEntity as CommentEntity)
              const linkEntity: Partial<LinkEntity> = { id: link.id, lastCommentTime: !link.lastCommentTime || dayjs(commentCreatedAt).isAfter(dayjs(link.lastCommentTime)) ? commentCreatedAt as any : link.lastCommentTime }
              linkEntities.push(linkEntity)

              const [comments, _] = await Promise.all([this.commentRepository.save(commentEntities), this.linkRepository.save(linkEntities)])
              this.facebookService.hideCmt({ comment: comments[0], link: linkRuning })

            }

          } catch (error) {
            console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
          } finally {

            if (link.delayTime) {
              await delay((linkRuning.delayTime) * 1000)
            }
          }
        }
      }

      for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
        runThread(threadOrder);
      }
    }
  }

  async processLinkPublic2(link: LinkEntity) {
    if (link.postIdV1) {
      const runThread = async (threadOrder: number) => {
        while (true) {
          if (link.postIdV1 === "917947140551487") console.time('aaaaa')
          const linkRuning = this.linksPublic.find(item => item.id === link.id)
          if (!linkRuning) { break };
          if (threadOrder > linkRuning.thread) { break };

          try {
            let res = await this.facebookService.getCmtPublic(link.postIdV1, link) || {} as any
            if (!res?.commentId || !res?.userIdComment) continue;
            const commentEntities: CommentEntity[] = []
            const linkEntities: Partial<LinkEntity>[] = []
            const {
              commentId,
              commentMessage,
              phoneNumber,
              userIdComment,
              userNameComment,
              commentCreatedAt,
            } = res
            let isSave = await this.checkIsSave(commentMessage)
            if (isSave) {
              const uid = (isNumeric(userIdComment) ? userIdComment : (await this.getUuidUserUseCase.getUuidUser(userIdComment)) || userIdComment)
              let newPhone = phoneNumber
              const commentEntity: Partial<CommentEntity> = {
                cmtId: commentId,
                linkId: link.id,
                postId: link.postId,
                userId: link.userId,
                uid,
                message: commentMessage,
                phoneNumber: newPhone,
                name: userNameComment,
                timeCreated: commentCreatedAt as any,
              }
              commentEntities.push(commentEntity as CommentEntity)
              const linkEntity: Partial<LinkEntity> = { id: link.id, lastCommentTime: !link.lastCommentTime || dayjs(commentCreatedAt).isAfter(dayjs(link.lastCommentTime)) ? commentCreatedAt : link.lastCommentTime }
              linkEntities.push(linkEntity)

              const [comments, _] = await Promise.all([this.commentRepository.save(commentEntities), this.linkRepository.save(linkEntities)])
              this.facebookService.hideCmt({ comment: comments[0], link: linkRuning })
            }


          } catch (error) {
            console.log(`Crawl comment with postId ${link.postId} Error.`, error)
          } finally {
            if (link.postIdV1 === "917947140551487") console.timeEnd('aaaaa')
            if (link.delayTime) {
              await delay((linkRuning.delayTime) * 1000)
            }
          }

        }
      }
      for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
        runThread(threadOrder);
      }
    }
  }

  async handlePostsPublic(linksRunning: LinkEntity[]) {
    const postHandle = linksRunning.map((link) => {
      return this.processLinkPublic1(link)
    })
    const postHandleV1 = linksRunning.map((link) => {
      return this.processLinkPublic2(link)
    })

    return Promise.all([...postHandle, ...postHandleV1])
  }

  async processLinkPrivate(link: LinkEntity) {
    const runThread = async (threadOrder: number) => {
      while (true) {
        const linkRuning = this.linksPrivate.find(item => item.id === link.id)
        if (!linkRuning) { break };
        if (threadOrder > linkRuning.thread) { break };

        try {
          const dataComment = await this.facebookService.getCommentByToken(link.postId, link.postIdV1)

          const {
            commentId,
            commentMessage,
            phoneNumber,
            userIdComment,
            userNameComment,
            commentCreatedAt,
          } = dataComment || {}

          if (!commentId || !userIdComment) continue;
          const commentEntities: CommentEntity[] = []
          const linkEntities: Partial<LinkEntity>[] = []
          let isSave = await this.checkIsSave(commentMessage)
          if (isSave) {
            const comment = await this.commentService.getComment(link.id, link.userId, commentId)
            if (!comment) {
              const uid = (isNumeric(userIdComment) ? userIdComment : (await this.getUuidUserUseCase.getUuidUser(userIdComment)) || userIdComment)
              if (phoneNumber) await this.facebookService.addPhone(uid, phoneNumber)
              const commentEntity: Partial<CommentEntity> = {
                cmtId: commentId,
                linkId: link.id,
                postId: link.postId,
                userId: link.userId,
                uid,
                message: commentMessage,
                phoneNumber: phoneNumber || (await this.facebookService.getPhoneNumber(uid, commentId)),
                name: userNameComment,
                timeCreated: commentCreatedAt as any,
              }
              commentEntities.push(commentEntity as CommentEntity)

              const linkEntity: Partial<LinkEntity> = { id: link.id, lastCommentTime: !link.lastCommentTime as any || dayjs(commentCreatedAt).isAfter(dayjs(link.lastCommentTime)) ? commentCreatedAt as any : link.lastCommentTime as any }
              linkEntities.push(linkEntity)
              await Promise.all([this.commentRepository.save(commentEntities), this.linkRepository.save(linkEntities)])
            }
          }
        } catch (error) {
          console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
        } finally {
          if (link.delayTime) {
            await delay((linkRuning.delayTime) * 1000)
          }
        }
      }
    }
    for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
      runThread(threadOrder);
    }

  }

  async handlePostsPrivate(linksRunning: LinkEntity[]) {
    const postHandle = linksRunning.map((link) => {
      return this.processLinkPrivate(link)
    })

    return Promise.all(postHandle)
  }

  async checkIsSave(commentMessage: string) {
    let isSave = true;

    const keywords = await this.settingService.getKeywordsAdmin()
    for (const keyword of keywords) {
      if (commentMessage.includes(keyword.keyword)) {
        isSave = false;
        break;
      }
    }

    return isSave
  }
}
