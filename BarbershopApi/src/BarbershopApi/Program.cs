using System.Text;
using AspNetCoreRateLimit;
using BarbershopApi.Data;
using BarbershopApi.Middleware;
using BarbershopApi.Models.Auth;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Databases ─────────────────────────────────────────────────────────────────

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AuthDb")));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AppDb")));

// ── Identity ──────────────────────────────────────────────────────────────────

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<AuthDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ─────────────────────────────────────────────────────────

var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30)
    };
    options.Events = new JwtBearerEvents
    {
        OnChallenge = ctx =>
        {
            ctx.HandleResponse();
            ctx.Response.StatusCode = 401;
            ctx.Response.ContentType = "application/json";
            return ctx.Response.WriteAsync("{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required.\",\"status\":401}}");
        }
    };
});

builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ── Rate Limiting ──────────────────────────────────────────────────────────────

builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("RateLimiting"));
builder.Services.Configure<IpRateLimitPolicies>(opt =>
{
    opt.IpRules =
    [
        new IpRateLimitPolicy
        {
            Ip = "*",
            Rules =
            [
                new RateLimitRule { Endpoint = "POST:/auth/login", Limit = 10, Period = "1m" },
                new RateLimitRule { Endpoint = "POST:/auth/register", Limit = 10, Period = "1m" },
                new RateLimitRule { Endpoint = "GET:/book/*", Limit = 60, Period = "1m" },
                new RateLimitRule { Endpoint = "POST:/book/*", Limit = 60, Period = "1m" },
                new RateLimitRule { Endpoint = "POST:/messaging/blast", Limit = 5, Period = "1h" },
                new RateLimitRule { Endpoint = "*", Limit = 300, Period = "1m" },
            ]
        }
    ];
});
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// ── Application Services ───────────────────────────────────────────────────────

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IAuditService, AuditService>();

// ── Controllers & Swagger ─────────────────────────────────────────────────────

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FlatPurse API",
        Version = "v1",
        Description = "SaaS revenue management platform for salons, barbershops, and beauty studios."
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Enter JWT token (without 'Bearer ' prefix)"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            []
        }
    });
});

// ── HTTPS Redirect ────────────────────────────────────────────────────────────

builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);

var app = builder.Build();

// ── Middleware Pipeline ────────────────────────────────────────────────────────

app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "FlatPurse API v1"));
}
else
{
    app.UseHttpsRedirection();
}

app.UseIpRateLimiting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Auto-migrate on startup (dev only) ────────────────────────────────────────

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await authDb.Database.MigrateAsync();
    await appDb.Database.MigrateAsync();
}

app.Run();
