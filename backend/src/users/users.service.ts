import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

interface CreateUserInput {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { telegramId },
    });
  }

  async upsertUser(data: CreateUserInput): Promise<User> {
    let user = await this.findByTelegramId(data.telegramId);

    if (user) {
      // Update existing user
      user.username = data.username || user.username;
      user.firstName = data.firstName;
      user.lastName = data.lastName || user.lastName;
      user.photoUrl = data.photoUrl || user.photoUrl;
      return this.userRepository.save(user);
    }

    // Create new user
    user = this.userRepository.create({
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      photoUrl: data.photoUrl,
    });

    return this.userRepository.save(user);
  }
}
