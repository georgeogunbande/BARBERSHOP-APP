using FluentValidation;

namespace BarbershopApi.Features.Staff.CreateStaffMember;

public sealed class CreateStaffMemberValidator : AbstractValidator<CreateStaffMemberCommand>
{
    public CreateStaffMemberValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Role).MaximumLength(100);
        RuleFor(x => x.Email).MaximumLength(200).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Bio).MaximumLength(1000);
    }
}
