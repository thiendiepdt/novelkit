import { describe, it, expect } from 'vitest';
import { niceTicks } from './format';

describe('niceTicks', () => {
  it('reaches at least the maximum in round steps', () => {
    expect(niceTicks(3150)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(niceTicks(900)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(96696)).toEqual([0, 25000, 50000, 75000, 100000]);
  });

  it('keeps a maximum that is already round', () => {
    expect(niceTicks(1000)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('never goes below whole numbers', () => {
    expect(niceTicks(2)).toEqual([0, 1, 2]);
  });

  it('has only zero for an empty day', () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});
