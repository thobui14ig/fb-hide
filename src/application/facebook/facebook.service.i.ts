import { LinkType } from "../links/entities/links.entity";

export interface IGetProfileLinkResponse {
    type: LinkType,
    name?: string,
    postId?: string,
}

export interface ICommentResponse {
    commentId: string,
    userNameComment: string,
    commentMessage: string,
    phoneNumber: string,
    userIdComment: string,
    commentCreatedAt: string,
}
