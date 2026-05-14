using FluentValidation;
using MediatR;
using BarbershopApi.Common;

namespace BarbershopApi.Common.Behaviors;

public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!_validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);

        var validationResults = await Task.WhenAll(
            _validators.Select(v => v.ValidateAsync(context, cancellationToken)));

        var failures = validationResults
            .Where(r => !r.IsValid)
            .SelectMany(r => r.Errors)
            .Where(f => f != null)
            .ToList();

        if (failures.Count == 0)
            return await next();

        var errorMessage = string.Join("; ", failures.Select(f => f.ErrorMessage));

        var responseType = typeof(TResponse);

        if (responseType.IsGenericType && responseType.GetGenericTypeDefinition() == typeof(Result<>))
        {
            var innerType = responseType.GetGenericArguments()[0];
            var failMethod = responseType.GetMethod("Fail", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            if (failMethod != null)
            {
                var result = failMethod.Invoke(null, [errorMessage]);
                if (result is TResponse typedResult)
                    return typedResult;
            }
        }

        if (responseType == typeof(Result))
        {
            var result = Result.Fail(errorMessage);
            if (result is TResponse typedResult)
                return typedResult;
        }

        throw new ValidationException(failures);
    }
}
