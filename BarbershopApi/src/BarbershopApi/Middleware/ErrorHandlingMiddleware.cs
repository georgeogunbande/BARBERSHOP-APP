using System.Net;
using System.Text.Json;

namespace BarbershopApi.Middleware;

public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteErrorAsync(context, ex);
        }
    }

    private static async Task WriteErrorAsync(HttpContext context, Exception ex)
    {
        var (status, code, message) = ex switch
        {
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "UNAUTHORIZED", "Authentication required."),
            KeyNotFoundException => (HttpStatusCode.NotFound, "NOT_FOUND", ex.Message),
            InvalidOperationException => (HttpStatusCode.BadRequest, "INVALID_OPERATION", ex.Message),
            ArgumentException => (HttpStatusCode.BadRequest, "BAD_REQUEST", ex.Message),
            _ => (HttpStatusCode.InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred.")
        };

        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";

        var requestId = context.TraceIdentifier;
        var body = JsonSerializer.Serialize(new
        {
            error = new
            {
                code,
                message,
                status = (int)status,
                request_id = requestId
            }
        }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower });

        await context.Response.WriteAsync(body);
    }
}
