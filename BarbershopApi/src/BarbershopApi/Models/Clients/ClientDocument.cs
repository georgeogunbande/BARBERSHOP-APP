using BarbershopApi.Models.Enums;

namespace BarbershopApi.Models.Clients;

public class ClientDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;
    public Guid BusinessId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public MediaType Type { get; set; } = MediaType.ClientDocument;
    public long FileSizeBytes { get; set; }
    public string UploadedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
