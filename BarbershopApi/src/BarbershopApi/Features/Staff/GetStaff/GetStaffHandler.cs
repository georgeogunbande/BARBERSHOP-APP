using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using BarbershopApi.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BarbershopApi.Features.Staff.GetStaff;

public sealed class GetStaffHandler : IRequestHandler<GetStaffQuery, Result<IReadOnlyList<StaffMember>>>
{
    private readonly AppDbContext _db;

    public GetStaffHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Result<IReadOnlyList<StaffMember>>> Handle(GetStaffQuery request, CancellationToken ct)
    {
        var staff = await _db.StaffMembers
            .Where(s => s.BarberShopId == request.BarberShopId)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        return Result<IReadOnlyList<StaffMember>>.Ok(staff);
    }
}
