package com.example;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MathUtilsTest {

    @Test
    void testAbs() {
        assertEquals(5, MathUtils.abs(-5));
        assertEquals(5, MathUtils.abs(5));
    }

    @Test
    void testMax() {
        assertEquals(7, MathUtils.max(3, 7));
        assertEquals(5, MathUtils.max(5, 2));
    }

    // min() NOT tested — should appear uncovered

    @Test
    void testSum() {
        assertEquals(10, MathUtils.sum(new int[]{1, 2, 3, 4}));
        assertEquals(0, MathUtils.sum(new int[]{}));
    }

    @Test
    void testAverage() {
        assertEquals(2.5, MathUtils.average(new int[]{1, 2, 3, 4}));
    }

    // average with empty array NOT tested — partial branch coverage

    @Test
    void testClamp() {
        assertEquals(5, MathUtils.clamp(5, 0, 10));
        assertEquals(0, MathUtils.clamp(-1, 0, 10));
    }

    // clamp above max NOT tested — partial branch coverage
}
