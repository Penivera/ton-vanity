import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TelegramAuthService } from './telegram-auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private telegramAuthService: TelegramAuthService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  @Post('telegram')
  async loginWithTelegram(@Body('initData') initData: string) {
    if (!initData) {
      throw new UnauthorizedException('initData is required');
    }

    // Validate Telegram InitData
    const validatedData = this.telegramAuthService.validateInitData(initData);

    // Create or update user in database
    const user = await this.usersService.upsertUser({
      telegramId: validatedData.user.id,
      username: validatedData.user.username,
      firstName: validatedData.user.first_name,
      lastName: validatedData.user.last_name,
      photoUrl: validatedData.user.photo_url,
    });

    // Generate JWT token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      telegramId: user.telegramId,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
      },
    };
  }
}
