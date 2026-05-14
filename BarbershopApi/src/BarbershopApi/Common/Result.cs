namespace BarbershopApi.Common;

public sealed class Result<T>
{
    public T? Value { get; }
    public string? Error { get; }
    public bool IsSuccess { get; }
    public bool IsNotFound { get; }

    private Result(T value)
    {
        Value = value;
        IsSuccess = true;
        IsNotFound = false;
    }

    private Result(string error, bool isNotFound = false)
    {
        Error = error;
        IsSuccess = false;
        IsNotFound = isNotFound;
    }

    public static Result<T> Ok(T value) => new(value);
    public static Result<T> Fail(string error) => new(error);
    public static Result<T> NotFound(string error) => new(error, isNotFound: true);
}

public sealed class Result
{
    public string? Error { get; }
    public bool IsSuccess { get; }
    public bool IsNotFound { get; }

    private Result()
    {
        IsSuccess = true;
        IsNotFound = false;
    }

    private Result(string error, bool isNotFound = false)
    {
        Error = error;
        IsSuccess = false;
        IsNotFound = isNotFound;
    }

    public static Result Ok() => new();
    public static Result Fail(string error) => new(error);
    public static Result NotFound(string error) => new(error, isNotFound: true);
}
