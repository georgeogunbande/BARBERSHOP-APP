using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using MediatR;

namespace BarbershopApi.Features.Staff.CreateStaffMember;

public sealed record CreateStaffMemberCommand(
    Guid BarberShopId,
    string Name,
    string Role,
    string Email,
    string Phone,
    string Bio,
    string WorkingHoursJson
) : IRequest<Result<StaffMember>>;
