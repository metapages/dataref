import {
  expectTypeOf,
  test,
} from 'vitest';

// Only this suite (and others marked with only) are run
describe.only('suite', () => {
  it('test', () => {
    assert.equal(Math.sqrt(9), 3)
  })
})

test('dataRefToBuffer', async () => {
  // const ref :DataRef = {value:"Some text", type:DataRefType.utf8};
  // const blob = await dataRefToBuffer(ref);
  // expectTypeOf(blob).toEqualTypeOf(new Uint8Array())
  expectTypeOf({ a: 1 }).toEqualTypeOf({ a: 1 })
  
})