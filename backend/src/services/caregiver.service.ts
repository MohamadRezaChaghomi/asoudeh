import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { decimalIntegerToBigInt } from '../utils/financialAmount.js';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
} from '../utils/jalaliMonth.js';
import { HttpError } from '../utils/httpError.js';
import { getMonthlyReport } from './reports.service.js';
import { listTransactions } from './transactions.service.js';
import type { TransactionQuery } from '../validators/transaction.validator.js';
import type {
  CaregiverDecisionInput,
  CaregiverPermission,
  InviteCaregiverInput,
} from '../validators/caregiver.validator.js';

type CaregiverAction =
  | 'caregiver.invited'
  | 'caregiver.accepted'
  | 'caregiver.rejected'
  | 'caregiver.revoked'
  | 'caregiver.summary_viewed'
  | 'caregiver.transactions_viewed'
  | 'caregiver.report_viewed';

interface LinkDocument {
  _id: mongoose.Types.ObjectId;
  seniorId:
    | mongoose.Types.ObjectId
    | {
        _id: mongoose.Types.ObjectId;
        name: string;
        deletionScheduledAt?: Date | null;
      };
  caregiverId?: mongoose.Types.ObjectId | null;
  caregiverPhone?: string;
  status: 'pending' | 'active' | 'revoked';
  permissions: {
    readSummary: boolean;
    readTransactions: boolean;
    readReports: boolean;
  };
  createdAt: Date;
  respondedAt?: Date | null;
  revokedAt?: Date | null;
}

export interface CaregiverLinkResponse {
  id: string;
  seniorId: string;
  caregiverId?: string;
  caregiverPhone: string;
  status: 'pending' | 'active' | 'revoked';
  permissions: CaregiverPermission[];
  createdAt: string;
  respondedAt?: string;
  revokedAt?: string;
}

export interface IncomingInvitationResponse extends CaregiverLinkResponse {
  seniorName: string;
}

export interface AccessibleSeniorResponse {
  seniorId: string;
  seniorName: string;
  permissions: CaregiverPermission[];
}

function linkPermissions(
  permissions: LinkDocument['permissions'],
): CaregiverPermission[] {
  return [
    ...(permissions.readSummary ? ['VIEW_SUMMARY' as const] : []),
    ...(permissions.readTransactions ? ['VIEW_TRANSACTIONS' as const] : []),
    ...(permissions.readReports ? ['VIEW_REPORTS' as const] : []),
  ];
}

function idString(value: LinkDocument['seniorId']): string {
  return ('_id' in value ? value._id : value).toString();
}

function toLinkResponse(link: LinkDocument): CaregiverLinkResponse {
  const seniorId = idString(link.seniorId);
  return {
    id: link._id.toString(),
    seniorId,
    ...(link.caregiverId ? { caregiverId: link.caregiverId.toString() } : {}),
    caregiverPhone: link.caregiverPhone ?? '',
    status: link.status,
    permissions: linkPermissions(link.permissions),
    createdAt: link.createdAt.toISOString(),
    ...(link.respondedAt ? { respondedAt: link.respondedAt.toISOString() } : {}),
    ...(link.revokedAt ? { revokedAt: link.revokedAt.toISOString() } : {}),
  };
}

function permissionField(permission: CaregiverPermission):
  | 'readSummary'
  | 'readTransactions'
  | 'readReports' {
  switch (permission) {
    case 'VIEW_SUMMARY':
      return 'readSummary';
    case 'VIEW_TRANSACTIONS':
      return 'readTransactions';
    case 'VIEW_REPORTS':
      return 'readReports';
  }
}

function permissionsDocument(permissions: CaregiverPermission[]) {
  return {
    readSummary: permissions.includes('VIEW_SUMMARY'),
    readTransactions: permissions.includes('VIEW_TRANSACTIONS'),
    readReports: permissions.includes('VIEW_REPORTS'),
  };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

async function writeAudit(
  actorId: string,
  targetUserId: string,
  action: CaregiverAction,
): Promise<void> {
  await AuditLog.create({
    actorId: new mongoose.Types.ObjectId(actorId),
    targetUserId: new mongoose.Types.ObjectId(targetUserId),
    action,
  });
}

export async function listCaregiverLinks(
  seniorId: string,
): Promise<CaregiverLinkResponse[]> {
  const links = (await CaregiverLink.find({
    seniorId: new mongoose.Types.ObjectId(seniorId),
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean()) as LinkDocument[];
  return links.map(toLinkResponse);
}

export async function inviteCaregiver(
  seniorId: string,
  input: InviteCaregiverInput,
): Promise<CaregiverLinkResponse> {
  const owner = await User.findById(seniorId).select('phone').lean();
  if (!owner) throw new HttpError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
  if (owner.phone && owner.phone === input.phone) {
    throw new HttpError(400, 'CAREGIVER_SELF_INVITATION', 'نمی‌توانید خودتان را دعوت کنید.');
  }

  const seniorObjectId = new mongoose.Types.ObjectId(seniorId);
  const existing = await CaregiverLink.findOne({
    seniorId: seniorObjectId,
    caregiverPhone: input.phone,
    status: { $in: ['pending', 'active'] },
  }).lean();
  if (existing) {
    throw new HttpError(409, 'CAREGIVER_LINK_EXISTS', 'برای این شماره دعوت فعال وجود دارد.');
  }

  const permissions = permissionsDocument(input.permissions);
  let link = await CaregiverLink.findOne({
    seniorId: seniorObjectId,
    caregiverPhone: input.phone,
    status: 'revoked',
  }).sort({ updatedAt: -1 });
  try {
    if (link) {
      link.status = 'pending';
      link.caregiverId = null;
      link.permissions = permissions;
      link.respondedAt = null;
      link.revokedAt = null;
      await link.save();
    } else {
      link = await CaregiverLink.create({
        seniorId: seniorObjectId,
        caregiverPhone: input.phone,
        status: 'pending',
        permissions,
      });
    }
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new HttpError(409, 'CAREGIVER_LINK_EXISTS', 'برای این شماره دعوت فعال وجود دارد.');
    }
    throw error;
  }
  await writeAudit(seniorId, seniorId, 'caregiver.invited');
  return toLinkResponse(link.toObject() as LinkDocument);
}

export async function listIncomingInvitations(
  caregiverId: string,
): Promise<IncomingInvitationResponse[]> {
  const caregiver = await User.findById(caregiverId).select('phone').lean();
  if (!caregiver?.phone) return [];
  const links = (await CaregiverLink.find({
    caregiverPhone: caregiver.phone,
    status: 'pending',
  })
    .populate<{ seniorId: { _id: mongoose.Types.ObjectId; name: string } }>({
      path: 'seniorId',
      select: 'name deletionScheduledAt',
    })
    .sort({ createdAt: -1, _id: -1 })
    .lean()) as LinkDocument[];
  return links.flatMap((link) => {
    if (
      typeof link.seniorId !== 'object' ||
      !('name' in link.seniorId) ||
      link.seniorId.deletionScheduledAt
    ) {
      return [];
    }
    return [{
      ...toLinkResponse(link),
      seniorName: link.seniorId.name,
    }];
  });
}

export async function listAccessibleSeniors(
  caregiverId: string,
): Promise<AccessibleSeniorResponse[]> {
  const links = (await CaregiverLink.find({
    caregiverId: new mongoose.Types.ObjectId(caregiverId),
    status: 'active',
    caregiverPhone: { $type: 'string' },
    respondedAt: { $ne: null },
  })
    .populate<{ seniorId: { _id: mongoose.Types.ObjectId; name: string } }>({
      path: 'seniorId',
      select: 'name deletionScheduledAt',
    })
    .sort({ respondedAt: -1, _id: -1 })
    .lean()) as LinkDocument[];
  return links.flatMap((link) => {
    if (
      typeof link.seniorId !== 'object' ||
      !('name' in link.seniorId) ||
      link.seniorId.deletionScheduledAt
    ) return [];
    return [{
      seniorId: link.seniorId._id.toString(),
      seniorName: link.seniorId.name,
      permissions: linkPermissions(link.permissions),
    }];
  });
}

export async function respondToInvitation(
  caregiverId: string,
  invitationId: string,
  input: CaregiverDecisionInput,
): Promise<CaregiverLinkResponse> {
  const caregiver = await User.findById(caregiverId).select('phone').lean();
  if (!caregiver?.phone) {
    throw new HttpError(403, 'CAREGIVER_PHONE_REQUIRED', 'برای پذیرش دعوت، شماره همراه حساب لازم است.');
  }
  const now = new Date();
  const update =
    input.decision === 'accept'
      ? {
          $set: {
            caregiverId: new mongoose.Types.ObjectId(caregiverId),
            status: 'active',
            respondedAt: now,
          },
        }
      : {
          $set: {
            status: 'revoked',
            respondedAt: now,
            revokedAt: now,
          },
        };
  const link = (await CaregiverLink.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(invitationId),
      caregiverPhone: caregiver.phone,
      status: 'pending',
    },
    update,
    { new: true, runValidators: true },
  ).lean()) as LinkDocument | null;
  if (!link) {
    throw new HttpError(404, 'CAREGIVER_INVITATION_NOT_FOUND', 'دعوت فعالی برای این حساب پیدا نشد.');
  }
  await writeAudit(
    caregiverId,
    idString(link.seniorId),
    input.decision === 'accept' ? 'caregiver.accepted' : 'caregiver.rejected',
  );
  return toLinkResponse(link);
}

export async function revokeCaregiverLink(
  seniorId: string,
  linkId: string,
): Promise<CaregiverLinkResponse> {
  const link = (await CaregiverLink.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(linkId),
      seniorId: new mongoose.Types.ObjectId(seniorId),
      status: { $in: ['pending', 'active'] },
    },
    { $set: { status: 'revoked', revokedAt: new Date() } },
    { new: true },
  ).lean()) as LinkDocument | null;
  if (!link) {
    const alreadyRevoked = (await CaregiverLink.findOne({
      _id: new mongoose.Types.ObjectId(linkId),
      seniorId: new mongoose.Types.ObjectId(seniorId),
      status: 'revoked',
    }).lean()) as LinkDocument | null;
    if (!alreadyRevoked) {
      throw new HttpError(404, 'CAREGIVER_LINK_NOT_FOUND', 'دسترسی پیدا نشد.');
    }
    return toLinkResponse(alreadyRevoked);
  }
  await writeAudit(seniorId, seniorId, 'caregiver.revoked');
  return toLinkResponse(link);
}

async function requireActivePermission(
  caregiverId: string,
  seniorId: string,
  permission: CaregiverPermission,
): Promise<LinkDocument> {
  const link = (await CaregiverLink.findOne({
    seniorId: new mongoose.Types.ObjectId(seniorId),
    caregiverId: new mongoose.Types.ObjectId(caregiverId),
    status: 'active',
    caregiverPhone: { $type: 'string' },
    respondedAt: { $ne: null },
  }).lean()) as LinkDocument | null;
  if (!link) {
    throw new HttpError(404, 'CAREGIVER_ACCESS_NOT_FOUND', 'دسترسی فعال پیدا نشد.');
  }
  const seniorIsActive = await User.exists({
    _id: new mongoose.Types.ObjectId(seniorId),
    deletionScheduledAt: null,
  });
  if (!seniorIsActive) {
    throw new HttpError(404, 'CAREGIVER_ACCESS_NOT_FOUND', 'دسترسی فعال پیدا نشد.');
  }
  if (!link.permissions[permissionField(permission)]) {
    throw new HttpError(403, 'CAREGIVER_PERMISSION_REQUIRED', 'این مجوز برای شما فعال نیست.');
  }
  return link;
}

export interface CaregiverSummaryResponse {
  period: {
    monthKey: string;
    startDate: string;
    endDateExclusive: string;
  };
  balance: {
    initialBalance: number;
    income: string;
    expenses: string;
    remaining: string;
  };
}

export async function getCaregiverSummary(
  caregiverId: string,
  seniorId: string,
): Promise<CaregiverSummaryResponse> {
  await requireActivePermission(caregiverId, seniorId, 'VIEW_SUMMARY');
  await writeAudit(caregiverId, seniorId, 'caregiver.summary_viewed');
  const ownerId = new mongoose.Types.ObjectId(seniorId);
  const { year, month, startDate, endDateExclusive } = getCurrentJalaliMonthRange();
  const [user, totals] = await Promise.all([
    User.findById(ownerId).select('initialBalance').lean(),
    Transaction.aggregate<{ _id: string; amount: { toString(): string } }>([
      {
        $match: {
          userId: ownerId,
          deletedAt: null,
          date: { $gte: startDate, $lt: endDateExclusive },
        },
      },
      {
        $group: {
          _id: '$type',
          amount: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]),
  ]);
  await requireActivePermission(caregiverId, seniorId, 'VIEW_SUMMARY');
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'کاربر پیدا نشد.');
  const income = totals.find(({ _id }) => _id === 'income');
  const expenses = totals.find(({ _id }) => _id === 'expense');
  const incomeAmount = income ? decimalIntegerToBigInt(income.amount.toString()) : 0n;
  const expenseAmount = expenses ? decimalIntegerToBigInt(expenses.amount.toString()) : 0n;
  const initialBalance = user.initialBalance ?? 0;
  if (!Number.isSafeInteger(initialBalance) || initialBalance < 0) {
    throw new HttpError(500, 'INVALID_FINANCIAL_DATA', 'موجودی اولیهٔ حساب معتبر نیست.');
  }
  return {
    period: {
      monthKey: formatJalaliMonthKey(year, month),
      startDate: formatUtcDateOnly(startDate),
      endDateExclusive: formatUtcDateOnly(endDateExclusive),
    },
    balance: {
      initialBalance,
      income: incomeAmount.toString(),
      expenses: expenseAmount.toString(),
      remaining: (BigInt(initialBalance) + incomeAmount - expenseAmount).toString(),
    },
  };
}

export async function getCaregiverTransactions(
  caregiverId: string,
  seniorId: string,
  query: TransactionQuery,
) {
  await requireActivePermission(caregiverId, seniorId, 'VIEW_TRANSACTIONS');
  await writeAudit(caregiverId, seniorId, 'caregiver.transactions_viewed');
  const transactions = await listTransactions(seniorId, query);
  await requireActivePermission(caregiverId, seniorId, 'VIEW_TRANSACTIONS');
  return transactions;
}

export async function getCaregiverReport(
  caregiverId: string,
  seniorId: string,
  monthKey: string,
) {
  await requireActivePermission(caregiverId, seniorId, 'VIEW_REPORTS');
  await writeAudit(caregiverId, seniorId, 'caregiver.report_viewed');
  const report = await getMonthlyReport(seniorId, monthKey);
  await requireActivePermission(caregiverId, seniorId, 'VIEW_REPORTS');
  return report;
}
