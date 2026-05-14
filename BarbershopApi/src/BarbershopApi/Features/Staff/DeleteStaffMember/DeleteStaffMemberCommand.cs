using BarbershopApi.Common;
using MediatR;

namespace BarbershopApi.Features.Staff.DeleteStaffMember;

public sealed record DeleteStaffMemberCommand(
    Guid Id,
    Guid BarberShopId
) : IRequest<Result>;
