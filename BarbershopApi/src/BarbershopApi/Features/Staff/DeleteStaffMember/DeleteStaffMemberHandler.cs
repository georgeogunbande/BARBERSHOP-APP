using BarbershopApi.Common;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Staff.DeleteStaffMember;

public sealed class DeleteStaffMemberHandler : IRequestHandler<DeleteStaffMemberCommand, Result>
{
    private readonly AppDbContext _db;

    public DeleteStaffMemberHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result> Handle(DeleteStaffMemberCommand request, CancellationToken ct)
    {
        var member = await _db.StaffMembers
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.BarberShopId == request.BarberShopId, ct);

        if (member is null)
            return Result.NotFound($"Staff member {request.Id} not found.");

        _db.StaffMembers.Remove(member);
        await _db.SaveChangesAsync(ct);

        return Result.Ok();
    }
}
