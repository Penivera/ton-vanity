import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly bot: any | null;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = token ? new TelegramBot(token, { polling: false }) : null;
  }

  async sendGenerationComplete(params: {
    telegramId: number;
    pattern: string;
    matchType: string;
    address: string;
    attempts: number;
  }): Promise<void> {
    if (!this.bot) {
      return;
    }

    const message = [
      'Vanity generation complete',
      `Pattern: ${params.pattern}`,
      `Match type: ${params.matchType}`,
      `Address: ${params.address}`,
      `Attempts: ${params.attempts}`,
    ].join('\n');

    try {
      await this.bot.sendMessage(params.telegramId, message);
    } catch (error) {
      this.logger.error('Failed to send Telegram completion message', error as Error);
    }
  }
}
