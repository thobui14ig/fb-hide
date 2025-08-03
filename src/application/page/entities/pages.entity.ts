
import { CookieEntity } from 'src/application/cookie/entities/cookie.entity';
import { LinkEntity } from 'src/application/links/entities/links.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pages')
export class PageEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string

    @OneToMany(() => LinkEntity, (links) => links.page)
    links: LinkEntity[];

    @OneToMany(() => CookieEntity, (cookies) => cookies.page)
    cookies: CookieEntity[];
}
