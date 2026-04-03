const { add, subtract, divide, clamp } = require('./math');

test('add', () => {
  expect(add(2, 3)).toBe(5);
});

test('subtract', () => {
  expect(subtract(5, 3)).toBe(2);
});

// multiply is intentionally NOT tested — should show as uncovered

test('divide', () => {
  expect(divide(10, 2)).toBe(5);
});

test('divide by zero', () => {
  expect(() => divide(1, 0)).toThrow('Division by zero');
});

test('clamp within range', () => {
  expect(clamp(5, 0, 10)).toBe(5);
});

test('clamp below min', () => {
  expect(clamp(-1, 0, 10)).toBe(0);
});

// clamp above max is NOT tested — should show as partial branch coverage
