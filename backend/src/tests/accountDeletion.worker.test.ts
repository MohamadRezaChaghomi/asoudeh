import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  findDueUsers: vi.fn(),
  findUser: vi.fn(),
  deleteUser: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('../models/User.js', () => ({
  default: {
    find: modelMocks.findDueUsers,
    findOne: modelMocks.findUser,
    deleteOne: modelMocks.deleteUser,
  },
}));

vi.mock('../models/AssistantRateLimit.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/AuditLog.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/AuthSession.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/Budget.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/CaregiverLink.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/Category.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/OtpChallenge.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/OtpRateLimit.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/Reminder.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/ReminderCompletion.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));
vi.mock('../models/Transaction.js', () => ({ default: { deleteMany: modelMocks.deleteMany } }));

import { purgeExpiredAccountDeletions } from '../services/accountDeletion.service.js';

describe('account-deletion worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues purging later users when one account fails', async () => {
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    const dueUsers = [{ _id: firstId, phone: null }, { _id: secondId, phone: null }];
    modelMocks.findDueUsers.mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({ lean: async () => dueUsers }),
        }),
      }),
    });
    modelMocks.findUser.mockImplementation((filter: { _id: mongoose.Types.ObjectId }) => ({
      select: () => ({
        lean: async () => {
          if (filter._id.equals(firstId)) throw new Error('test database failure');
          return { _id: secondId, phone: null };
        },
      }),
    }));
    modelMocks.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    modelMocks.deleteUser.mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    await expect(purgeExpiredAccountDeletions()).resolves.toBe(1);
    expect(modelMocks.findUser).toHaveBeenCalledTimes(2);
    expect(modelMocks.deleteUser).toHaveBeenCalledOnce();
    expect(modelMocks.deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ _id: secondId }),
    );
  });
});
