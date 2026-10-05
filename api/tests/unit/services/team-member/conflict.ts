import { FakeQuery } from '../../../helpers/fake-db.js';

interface ConflictQuery {
  onConflictDoNothing?: (...args: unknown[]) => FakeQuery;
}

const prototype: ConflictQuery = FakeQuery.prototype;

prototype.onConflictDoNothing = function onConflictDoNothing(this: FakeQuery): FakeQuery {
  return this;
};
