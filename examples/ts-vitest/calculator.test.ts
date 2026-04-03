import { describe, it, expect } from 'vitest';
import { Calculator } from './calculator';

describe('Calculator', () => {
  const calc = new Calculator();

  it('adds two numbers', () => {
    expect(calc.add(1, 2)).toBe(3);
  });

  it('subtracts two numbers', () => {
    expect(calc.subtract(5, 3)).toBe(2);
  });

  // multiply intentionally not tested

  it('divides two numbers', () => {
    expect(calc.divide(10, 2)).toBe(5);
  });

  it('throws on division by zero', () => {
    expect(() => calc.divide(1, 0)).toThrow();
  });

  it('calculates power', () => {
    expect(calc.power(2, 3)).toBe(8);
  });

  // negative exponent NOT tested — partial coverage on power()

  it('calculates factorial', () => {
    expect(calc.factorial(5)).toBe(120);
    expect(calc.factorial(0)).toBe(1);
  });

  // negative factorial NOT tested
});
