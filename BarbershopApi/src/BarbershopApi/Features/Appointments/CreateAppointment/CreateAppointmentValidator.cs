using FluentValidation;

namespace BarbershopApi.Features.Appointments.CreateAppointment;

public sealed class CreateAppointmentValidator : AbstractValidator<CreateAppointmentCommand>
{
    public CreateAppointmentValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.StaffMemberId).NotEmpty();
        RuleFor(x => x.ServiceId).NotEmpty();
        RuleFor(x => x.ScheduledAt).NotEmpty().GreaterThan(DateTime.UtcNow.AddMinutes(-5));
        RuleFor(x => x.DurationMinutes).GreaterThan(0).LessThanOrEqualTo(480);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
