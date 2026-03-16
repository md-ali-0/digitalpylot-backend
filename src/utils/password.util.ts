import { ApiError } from '@core/error.classes';
import bcrypt from 'bcryptjs';

export class PasswordUtil {
  private static SALT_ROUNDS = 10;

  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(password, salt);
      return hashedPassword;
    } catch {
      throw ApiError.InternalServerError('Failed to hash password', 'password.hashing_failed');
    }
  }

  static async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch {
      throw ApiError.InternalServerError(
        'Failed to compare passwords',
        'password.comparison_failed',
      );
    }
  }
}
