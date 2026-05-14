using FluentValidation;

namespace BarbershopApi.Features.Clients.CreateClient;

public sealed class CreateClientValidator : AbstractValidator<CreateClientCommand>
{
    public CreateClientValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Email).MaximumLength(200).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Tags).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
