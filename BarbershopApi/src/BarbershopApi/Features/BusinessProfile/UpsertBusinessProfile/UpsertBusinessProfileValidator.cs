using FluentValidation;

namespace BarbershopApi.Features.BusinessProfile.UpsertBusinessProfile;

public sealed class UpsertBusinessProfileValidator : AbstractValidator<UpsertBusinessProfileCommand>
{
    public UpsertBusinessProfileValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.Email).MaximumLength(200).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Website).MaximumLength(500);
        RuleFor(x => x.BookingLinkSlug).MaximumLength(200);
        RuleFor(x => x.LogoUrl).MaximumLength(500);
    }
}
