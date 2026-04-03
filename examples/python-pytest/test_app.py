from app import greet, is_palindrome, fizzbuzz, fibonacci


def test_greet_with_name():
    assert greet("Alice") == "Hello, Alice!"


def test_greet_empty():
    assert greet("") == "Hello, stranger!"


def test_palindrome_true():
    assert is_palindrome("racecar") is True


def test_palindrome_false():
    assert is_palindrome("hello") is False


def test_fizzbuzz_fizz():
    assert fizzbuzz(3) == "Fizz"


def test_fizzbuzz_buzz():
    assert fizzbuzz(5) == "Buzz"


# fizzbuzz(15) NOT tested — FizzBuzz branch uncovered


def test_fizzbuzz_number():
    assert fizzbuzz(7) == "7"


def test_fibonacci():
    assert fibonacci(0) == 0
    assert fibonacci(1) == 1
    assert fibonacci(10) == 55


# fibonacci negative NOT tested
