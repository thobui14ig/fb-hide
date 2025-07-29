import { LinkEntity, LinkStatus, LinkType } from "../links/entities/links.entity";

export interface GroupedLinksByType {
    public: LinkEntity[];
    private: LinkEntity[];
}

export interface IPostStarted {
    postId: string,
    status: LinkStatus,
    type: LinkType
}