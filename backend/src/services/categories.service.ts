import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.validator.js';

type CategoryType = 'income' | 'expense' | 'both';

const systemCategoryDefaults: Array<{ name: string; type: 'income' | 'expense' }> = [
  { name: 'خوراک', type: 'expense' },
  { name: 'دارو و درمان', type: 'expense' },
  { name: 'قبوض', type: 'expense' },
  { name: 'مسکن', type: 'expense' },
  { name: 'حمل‌ونقل', type: 'expense' },
  { name: 'خانواده و هدیه', type: 'expense' },
  { name: 'تفریح', type: 'expense' },
  { name: 'متفرقه', type: 'expense' },
  { name: 'حقوق', type: 'income' },
  { name: 'کمک خانواده', type: 'income' },
  { name: 'سایر', type: 'income' },
];

interface CategoryRecord {
  _id: { toString(): string };
  userId?: { toString(): string } | null;
  name: string;
  type: CategoryType;
  icon?: string;
  isActive?: boolean;
}

export interface CategoryResponse {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
}

function toCategoryResponse(category: CategoryRecord): CategoryResponse {
  return {
    id: category._id.toString(),
    name: category.name,
    type: category.type,
    icon: category.icon ?? 'wallet',
    isActive: category.isActive ?? true,
    isDefault: category.userId == null,
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

function throwCategoryConflict(error: unknown): never {
  if (isDuplicateKey(error)) {
    throw new HttpError(409, 'CATEGORY_ALREADY_EXISTS', 'این دسته‌بندی از قبل وجود دارد.');
  }

  throw error;
}

export async function listCategories(userId: string): Promise<CategoryResponse[]> {
  const categories = await Category.find({
    $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }],
  })
    .sort({ type: 1, name: 1 })
    .lean();

  return categories.map((category) => toCategoryResponse(category));
}

export async function seedSystemCategories(): Promise<number> {
  await Category.init();
  const result = await Category.bulkWrite(
    systemCategoryDefaults.map(({ name, type }) => ({
      updateOne: {
        filter: { userId: null, type, name },
        update: { $setOnInsert: { userId: null, type, name } },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  return result.upsertedCount;
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryResponse> {
  try {
    const category = await Category.create({
      ...input,
      userId: new mongoose.Types.ObjectId(userId),
    });

    return toCategoryResponse(category);
  } catch (error) {
    throwCategoryConflict(error);
  }
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CategoryResponse> {
  try {
    const category = await Category.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(categoryId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: input },
      { new: true, runValidators: true },
    ).lean();

    if (!category) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد.');
    }

    return toCategoryResponse(category);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throwCategoryConflict(error);
  }
}

export async function rejectCategoryDeletion(
  userId: string,
  categoryId: string,
): Promise<never> {
  const category = await Category.exists({
    _id: new mongoose.Types.ObjectId(categoryId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!category) {
    throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد.');
  }

  throw new HttpError(
    409,
    'CATEGORY_DELETION_UNAVAILABLE',
    'حذف دسته‌بندی تا زمان فراهم‌شدن انتقال امن تراکنش‌ها در دسترس نیست؛ می‌توانید دسته را غیرفعال کنید.',
  );
}
