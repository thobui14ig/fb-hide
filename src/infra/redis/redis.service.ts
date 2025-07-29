// redis.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    constructor(@InjectRedis() private readonly redis: Redis) { }

    async checkAndUpdateKey(newKey: string): Promise<boolean> {
        try {
            const [linkId, newDateStr] = newKey.split('_');
            const newDate = parseInt(newDateStr, 10);

            // Nếu key mới đã tồn tại → return true
            const isExisting = await this.redis.exists(newKey);
            if (isExisting) {
                return true;
            }

            // Tìm key cũ cùng linkId (dạng linkId_*)
            const matchedKeys = await this.redis.keys(`${linkId}_*`);

            if (matchedKeys.length > 0) {
                const currentKey = matchedKeys[0];
                const [, currentDateStr] = currentKey.split('_');
                const currentDate = parseInt(currentDateStr, 10);

                if (newDate < currentDate) {
                    return true; // Giữ nguyên key cũ
                } else {
                    // Xóa key cũ
                    await this.redis.del(currentKey);

                    // Dùng NX để chỉ set nếu key mới chưa tồn tại (đảm bảo an toàn)
                    const setResult = await this.redis.set(newKey, '1', 'NX');
                    // setResult === 'OK' nếu set thành công, null nếu không set được (đã tồn tại)
                    return false;
                }
            }

            // Không có key nào → set mới với NX
            const setResult = await this.redis.set(newKey, '1', 'NX');
            return setResult === null ? true : false; // Nếu không set được (đã tồn tại) trả về true, ngược lại false            
        } catch (error) {
            console.log("🚀 ~ RedisService ~ checkAndUpdateKey ~ error:", error)
            return true
        }

    }

    async SLAVEOF() {
        await this.redis.call('SLAVEOF', ['NO', 'ONE']);

        return this.clearAll()
    }

    async clearAll() {
        await this.redis.flushall();
    }
}
