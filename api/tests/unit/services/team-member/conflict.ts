import { FakeQuery } from '../../../helpers/fake-db.js';

Object.assign(FakeQuery.prototype, {
  onConflictDoNothing(this: FakeQuery): FakeQuery {
    return this;
  },
});
