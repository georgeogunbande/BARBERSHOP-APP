namespace BarbershopApi.Models.Business;

public class BusinessHours
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Business Business { get; set; } = null!;
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly OpenTime { get; set; }
    public TimeOnly CloseTime { get; set; }
    public bool IsClosed { get; set; } = false;
}

public class FamilyHoursConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BusinessId { get; set; }
    public Business Business { get; set; } = null!;
    public bool IsEnabled { get; set; } = false;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public List<DayOfWeek> Days { get; set; } = [];
    public string? Message { get; set; }
}
