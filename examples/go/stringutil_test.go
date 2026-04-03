package stringutil

import "testing"

func TestReverse(t *testing.T) {
	got := Reverse("hello")
	if got != "olleh" {
		t.Errorf("Reverse(\"hello\") = %q, want \"olleh\"", got)
	}
}

func TestIsPalindrome(t *testing.T) {
	if !IsPalindrome("Racecar") {
		t.Error("expected Racecar to be palindrome")
	}
	if IsPalindrome("hello") {
		t.Error("expected hello to not be palindrome")
	}
}

// Truncate is partially tested — only the "too long" case
func TestTruncate(t *testing.T) {
	got := Truncate("Hello, World!", 5)
	if got != "Hello..." {
		t.Errorf("Truncate = %q, want \"Hello...\"", got)
	}
}

// WordCount is NOT tested — should appear fully uncovered

// Capitalize is tested
func TestCapitalize(t *testing.T) {
	if Capitalize("hello") != "Hello" {
		t.Error("expected Hello")
	}
	if Capitalize("") != "" {
		t.Error("expected empty string")
	}
}
