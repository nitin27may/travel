import type { RowGroup } from '@/lib/entities/sort';

export function GroupHeading<Row>({ group, id }: { group: RowGroup<Row>; id: string }) {
  if (!group.key && !group.title) return null;
  return (
    <h2 className="group-head" id={id}>
      <span className="gh-title">{group.title}</span>
      {group.subtitle ? <span className="gh-sub">{group.subtitle}</span> : null}
      <span className="gh-count num">{group.rows.length}</span>
    </h2>
  );
}
