using FluentValidation;

namespace BarbershopApi.Features.Staff.UpdateStaffMember;

public sealed class UpdateStaffMemberValidator : AbstractValidator<UpdateStaffMemberCommand>
{
    public UpdateStaffMemberValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Role).MaximumLength(100);
        RuleFor(x => x.Email).MaximumLength(200).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Bio).MaximumLength(1000);
    }
}
