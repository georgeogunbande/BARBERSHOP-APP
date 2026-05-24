using FlatPurse;
using FlatPurse.Services;
using FlatPurse.Web.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddScoped<ITokenStorage, WebLocalStorageTokenStorage>();
builder.Services.AddFlatPurseServices(
    builder.Configuration["ApiBaseUrl"] ?? "http://localhost:5000");

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<FlatPurse.Web.Components.App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(typeof(FlatPurse.Components.App).Assembly);

app.Run();
