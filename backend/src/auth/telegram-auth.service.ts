import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

interface TelegramInitData {
  query_id: string;
  user: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

@Injectable()
export class TelegramAuthService {
  validateInitData(initData: string): TelegramInitData {
    if (!initData) {
      throw new UnauthorizedException('No initData provided');
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    try {
      // Parse initData string
      const data = Object.fromEntries(new URLSearchParams(initData));

      const hash = data.hash;
      delete data.hash;

      // Create checkString from data
      const checkString = Object.keys(data)
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join('\n');

      // Create secret key
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Verify hash
      const computedHash = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

      if (hash !== computedHash) {
        throw new UnauthorizedException('Invalid initData hash');
      }

      // Check auth_date freshness (within 24 hours)
      const authDate = parseInt(data.auth_date as string);
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - authDate > 86400) {
        throw new UnauthorizedException('InitData expired');
      }

      // Parse user object
      const user = JSON.parse(data.user as string);

      return {
        query_id: data.query_id as string,
        user,
        auth_date: authDate,
        hash,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to validate initData');
    }
  }
}
