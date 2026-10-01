import { expect, it } from 'vitest';
import { applyStickyOrder, mergeStickyOrder, parseStickyOrder, stickyOrderKey } from './sticky-order';
it('validates stored data', () => {
  expect(parseStickyOrder('{')).toEqual([]);
  expect(parseStickyOrder('{}')).toEqual([]);
  expect(parseStickyOrder('["a",null,3,"a","","b"]')).toEqual(['a','b']);
});
it('restores saved order and puts new notes first', () => {
  expect(applyStickyOrder([{id:'a'},{id:'new'},{id:'b'}],['deleted','b','a']).map(x=>x.id)).toEqual(['new','b','a']);
});
it('preserves hidden slots when filtering', () => {
  expect(mergeStickyOrder(['a','b','c','d'],['a','c'],['c','a'])).toEqual(['c','b','a','d']);
});
it('remembers initial order and subsequently added notes', () => {
  const first = mergeStickyOrder([],['a','b','c'],['c','a','b']);
  expect(first).toEqual(['c','a','b']);
  expect(mergeStickyOrder(first,['new','c','a','b'],['c','a','new','b'])).toEqual(['c','a','new','b']);
});
it('uses versioned workspace-scoped storage', () => {
  expect(stickyOrderKey('a')).not.toEqual(stickyOrderKey('b'));
  expect(stickyOrderKey('a')).toContain(':v1:');
});
