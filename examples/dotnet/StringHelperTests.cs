using Xunit;

namespace CoverLensDemo.Tests;

public class StringHelperTests
{
    [Fact]
    public void Repeat_ReturnsRepeatedString()
    {
        Assert.Equal("abcabc", StringHelper.Repeat("abc", 2));
    }

    [Fact]
    public void Repeat_EmptyString_ReturnsEmpty()
    {
        Assert.Equal(string.Empty, StringHelper.Repeat("", 3));
    }

    // Repeat with negative count NOT tested — should be uncovered

    [Fact]
    public void ToCamelCase_Works()
    {
        Assert.Equal("helloWorld", StringHelper.ToCamelCase("Hello World"));
    }

    [Fact]
    public void ToCamelCase_Empty_ReturnsEmpty()
    {
        Assert.Equal(string.Empty, StringHelper.ToCamelCase(""));
    }

    [Fact]
    public void IsEmail_Valid()
    {
        Assert.True(StringHelper.IsEmail("user@example.com"));
    }

    [Fact]
    public void IsEmail_Invalid()
    {
        Assert.False(StringHelper.IsEmail("not-an-email"));
    }

    // Slugify NOT tested — should appear fully uncovered
}
