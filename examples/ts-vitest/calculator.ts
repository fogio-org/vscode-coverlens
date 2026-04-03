export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Cannot divide by zero');
    }
    return a / b;
  }

  power(base: number, exp: number): number {
    if (exp < 0) {
      return 1 / this.power(base, -exp);
    }
    let result = 1;
    for (let i = 0; i < exp; i++) {
      result *= base;
    }
    return result;
  }

  factorial(n: number): number {
    if (n < 0) {
      throw new Error('Negative factorial');
    }
    if (n <= 1) {
      return 1;
    }
    return n * this.factorial(n - 1);
  }
}
