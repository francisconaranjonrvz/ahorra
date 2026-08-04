export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  kind: 'expense' | 'income';
  path: string[];
  depth: number;
  isArchived: boolean;
  sortOrder: number;
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[];
}

/** Reconstruye el árbol a partir de filas planas (usa `parentId`, no `path`). */
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: CategoryNode[] = [];

  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parentId === null) {
      roots.push(node);
    } else {
      byId.get(row.parentId)?.children.push(node);
    }
  }

  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** true si `ancestorId` es un ancestro estricto de `row` (usa el `path` materializado). */
export function isDescendantOf(row: Pick<CategoryRow, 'path' | 'id'>, ancestorId: string): boolean {
  return row.path.includes(ancestorId) && row.id !== ancestorId;
}

export function readablePath(
  row: Pick<CategoryRow, 'path'>,
  byId: Map<string, CategoryRow>,
): string {
  return row.path
    .map((id) => byId.get(id)?.name)
    .filter(Boolean)
    .join(' › ');
}
