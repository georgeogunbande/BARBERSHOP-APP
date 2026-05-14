using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Staff.UpdateStaffMember;

public sealed class UpdateStaffMemberHandler : IRequestHandler<UpdateStaffMemberCommand, Result<StaffMember>>
{
    private readonly AppDbContext _db;

    public UpdateStaffMemberHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<StaffMember>> Handle(UpdateStaffMemberCommand request, CancellationToken ct)
    {
        var member = await _db.StaffMembers
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.BarberShopId == request.BarberShopId, ct);

        if (member is null)
            return Result<StaffMember>.NotFound($"Staff member {request.Id} not found.");

        member.Name = request.Name;
        member.Role = request.Role;
        member.Email = request.Email;
        member.Phone = request.Phone;
        member.Bio = request.Bio;
        member.IsActive = request.IsActive;
        member.WorkingHoursJson = string.IsNullOrEmpty(request.WorkingHoursJson) ? "{}" : request.WorkingHoursJson;

        await _db.SaveChangesAsync(ct);

        return Result<StaffMember>.Ok(member);
    }
}
