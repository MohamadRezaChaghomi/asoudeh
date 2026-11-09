export interface DuplicateIndex {
  modelName: string;
  indexName: string;
  findDuplicates: () => Promise<Array<{ key: unknown; count: number; sampleIds: unknown[] }>>;
}

export interface IndexModel {
  modelName: string;
  uniqueIndexes: DuplicateIndex[];
  createIndexes: () => Promise<unknown>;
}

export async function ensureIndexes(
  models: IndexModel[],
  report: (message: string) => void = console.error,
): Promise<boolean> {
  const duplicates: Array<{
    modelName: string;
    indexName: string;
    entries: Array<{ key: unknown; count: number; sampleIds: unknown[] }>;
  }> = [];

  for (const model of models) {
    for (const index of model.uniqueIndexes) {
      const entries = await index.findDuplicates();
      if (entries.length) {
        duplicates.push({ modelName: model.modelName, indexName: index.indexName, entries });
      }
    }
  }

  if (duplicates.length) {
    for (const duplicate of duplicates) {
      report(JSON.stringify(duplicate));
    }
    return false;
  }

  for (const model of models) {
    await model.createIndexes();
  }
  return true;
}
