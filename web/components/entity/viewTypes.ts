import type { RowGroup } from '@/lib/entities/sort';
import type { EntityDescriptor, ListState } from '@/lib/entities/types';

export interface ViewProps<Row> {
  d: EntityDescriptor<Row>;
  groups: RowGroup<Row>[];
  state: ListState;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
  onOpen: (id: string, trigger: HTMLElement) => void;
}
