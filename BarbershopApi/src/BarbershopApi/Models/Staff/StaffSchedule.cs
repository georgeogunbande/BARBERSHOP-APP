namespace BarbershopApi.Models.Staff;

public class StaffSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StaffMemberId { get; set; }
    public StaffMember StaffMember { get; set; } = null!;
    public Guid BusinessId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsWorkingDay { get; set; } = true;
}
