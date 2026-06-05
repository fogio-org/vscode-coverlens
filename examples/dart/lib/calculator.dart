int add(int a, int b) => a + b;

int subtract(int a, int b) => a - b;

/// Intentionally left untested to demonstrate uncovered (red) lines.
int multiply(int a, int b) => a * b;

String classify(int n) {
  if (n < 0) {
    return 'negative';
  }
  if (n == 0) {
    return 'zero';
  }
  return 'positive';
}
