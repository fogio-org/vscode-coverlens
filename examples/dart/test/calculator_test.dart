import 'package:coverlens_dart_example/calculator.dart';
import 'package:test/test.dart';

void main() {
  test('add', () => expect(add(2, 3), 5));
  test('subtract', () => expect(subtract(5, 2), 3));

  // multiply() is deliberately not tested → uncovered.

  test('classify positive', () => expect(classify(4), 'positive'));
  test('classify negative', () => expect(classify(-1), 'negative'));
  // classify(0) is never exercised → that branch stays uncovered.
}
