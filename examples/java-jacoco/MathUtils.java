package com.example;

public class MathUtils {

    public static int abs(int n) {
        if (n < 0) {
            return -n;
        }
        return n;
    }

    public static int max(int a, int b) {
        if (a >= b) {
            return a;
        }
        return b;
    }

    public static int min(int a, int b) {
        if (a <= b) {
            return a;
        }
        return b;
    }

    public static int sum(int[] numbers) {
        int total = 0;
        for (int n : numbers) {
            total += n;
        }
        return total;
    }

    public static double average(int[] numbers) {
        if (numbers.length == 0) {
            throw new IllegalArgumentException("Empty array");
        }
        return (double) sum(numbers) / numbers.length;
    }

    public static int clamp(int value, int min, int max) {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }
}
