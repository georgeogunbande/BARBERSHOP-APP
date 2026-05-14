using BarbershopApi.Common;
using BarbershopApi.Features.Staff.Entities;
using MediatR;

namespace BarbershopApi.Features.Staff.GetStaff;

public sealed record GetStaffQuery(
    Guid BarberShopId
) : IRequest<Result<IReadOnlyList<StaffMember>>>;
