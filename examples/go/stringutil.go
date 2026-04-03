package stringutil

import "strings"

// Reverse returns the reverse of a string.
func Reverse(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

// IsPalindrome checks if a string reads the same forwards and backwards.
func IsPalindrome(s string) bool {
	lower := strings.ToLower(s)
	return lower == Reverse(lower)
}

// Truncate shortens a string to maxLen and appends "..." if needed.
func Truncate(s string, maxLen int) string {
	if maxLen <= 0 {
		return ""
	}
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// WordCount returns the number of words in a string.
func WordCount(s string) int {
	words := strings.Fields(s)
	return len(words)
}

// Capitalize returns the string with the first letter uppercased.
func Capitalize(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
