using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Business;

public class BusinessMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Business Business { get; set; } = null!;
    public string Url { get; set; } = string.Empty;
    public MediaType Type { get; set; }
    public string? FileName { get; set; }
    public long? FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
