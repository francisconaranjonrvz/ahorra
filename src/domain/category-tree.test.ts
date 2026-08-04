import { describe, expect, it } from 'vitest';

import { buildCategoryTree, isDescendantOf, type CategoryRow } from './category-tree';

function row(
  partial: Partial<CategoryRow> & Pick<CategoryRow, 'id' | 'parentId' | 'path' | 'depth'>,
): CategoryRow {
  return {
    name: partial.id,
    icon: null,
    color: null,
    kind: 'expense',
    isArchived: false,
    sortOrder: 0,
    ...partial,
  };
}

describe('buildCategoryTree', () => {
  it('anida hijos bajo su padre en 3 niveles', () => {
    const rows = [
      row({ id: 'food', parentId: null, path: ['food'], depth: 0 }),
      row({ id: 'super', parentId: 'food', path: ['food', 'super'], depth: 1 }),
      row({ id: 'meat', parentId: 'super', path: ['food', 'super', 'meat'], depth: 2 }),
    ];
    const tree = buildCategoryTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('meat');
  });

  it('ordena por sortOrder en cada nivel', () => {
    const rows = [
      row({ id: 'b', parentId: null, path: ['b'], depth: 0, sortOrder: 1 }),
      row({ id: 'a', parentId: null, path: ['a'], depth: 0, sortOrder: 0 }),
    ];
    const tree = buildCategoryTree(rows);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('isDescendantOf', () => {
  it('es true para un descendiente estricto', () => {
    expect(isDescendantOf({ id: 'meat', path: ['food', 'super', 'meat'] }, 'food')).toBe(true);
  });

  it('es false para sí mismo', () => {
    expect(isDescendantOf({ id: 'food', path: ['food'] }, 'food')).toBe(false);
  });
});
