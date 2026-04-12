import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByFirebaseUid(firebaseUid: string) {
    return this.repo.findOne({ where: { firebaseUid } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async create(data: Partial<UserEntity>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(id: string, data: Partial<UserEntity>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string) {
    await this.repo.delete(id);
  }
}
