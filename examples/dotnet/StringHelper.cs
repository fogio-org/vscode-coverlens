namespace CoverLensDemo;

public static class StringHelper
{
    public static string Repeat(string text, int count)
    {
        if (count < 0)
        {
            throw new ArgumentException("Count cannot be negative");
        }

        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        return string.Concat(Enumerable.Repeat(text, count));
    }

    public static string ToCamelCase(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var words = input.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var result = words[0].ToLower();

        for (int i = 1; i < words.Length; i++)
        {
            result += char.ToUpper(words[i][0]) + words[i][1..].ToLower();
        }

        return result;
    }

    public static bool IsEmail(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return false;
        }

        var atIndex = input.IndexOf('@');
        if (atIndex <= 0 || atIndex >= input.Length - 1)
        {
            return false;
        }

        return input[atIndex..].Contains('.');
    }

    public static string Slugify(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        return input
            .ToLower()
            .Replace(" ", "-")
            .Replace("_", "-");
    }
}
