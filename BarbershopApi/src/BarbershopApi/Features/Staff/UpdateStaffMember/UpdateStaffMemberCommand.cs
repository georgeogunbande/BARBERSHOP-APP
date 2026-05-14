using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using MediatR;

namespace BarbershopApi.Features.Staff.UpdateStaffMember;

public sealed record UpdateStaffMemberCommand(
    Guid Id,
    Guid BarberShopId,
    string Name,
    string Role,
    string Email,
    string Phone,
    string Bio,
    bool IsActive,
    string WorkingHoursJson
) : IRequest<Result<StaffMember>>;
