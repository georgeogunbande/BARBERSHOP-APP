using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;

namespace BarbershopApi.Features.Staff.CreateStaffMember;

public sealed class CreateStaffMemberHandler : IRequestHandler<CreateStaffMemberCommand, Result<StaffMember>>
{
    private readonly AppDbContext _db;

    public CreateStaffMemberHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<StaffMember>> Handle(CreateStaffMemberCommand request, CancellationToken ct)
    {
        var member = new StaffMember
        {
            Id = Guid.NewGuid(),
            BarberShopId = request.BarberShopId,
            Name = request.Name,
            Role = request.Role,
            Email = request.Email,
            Phone = request.Phone,
            Bio = request.Bio,
            WorkingHoursJson = string.IsNullOrEmpty(request.WorkingHoursJson) ? "{}" : request.WorkingHoursJson,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.StaffMembers.Add(member);
        await _db.SaveChangesAsync(ct);

        return Result<StaffMember>.Ok(member);
    }
}
