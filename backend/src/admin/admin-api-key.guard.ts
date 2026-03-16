import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('ADMIN_API_KEY is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const headerValue = request.headers['x-admin-key'];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!provided || typeof provided !== 'string') {
      throw new UnauthorizedException('Missing x-admin-key header');
    }

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided.trim(), 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      throw new UnauthorizedException('Invalid admin key');
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new UnauthorizedException('Invalid admin key');
    }

    return true;
  }
}
