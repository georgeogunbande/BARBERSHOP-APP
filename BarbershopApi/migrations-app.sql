IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [Appointments] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [ClientId] uniqueidentifier NOT NULL,
        [StaffMemberId] uniqueidentifier NOT NULL,
        [ServiceId] uniqueidentifier NOT NULL,
        [ScheduledAt] datetime2 NOT NULL,
        [DurationMinutes] int NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [Notes] nvarchar(max) NOT NULL,
        [Price] decimal(18,2) NOT NULL,
        [TipAmount] decimal(18,2) NOT NULL,
        [PaymentMethod] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Appointments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [BusinessProfiles] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Address] nvarchar(500) NOT NULL,
        [Phone] nvarchar(50) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Website] nvarchar(500) NOT NULL,
        [BookingLinkSlug] nvarchar(200) NOT NULL,
        [LogoUrl] nvarchar(500) NOT NULL,
        [WorkingHoursJson] nvarchar(max) NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_BusinessProfiles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [Clients] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Phone] nvarchar(50) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Tags] nvarchar(500) NOT NULL,
        [Notes] nvarchar(max) NOT NULL,
        [TotalVisits] int NOT NULL,
        [TotalSpent] decimal(18,2) NOT NULL,
        [LastVisitAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Clients] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [Notifications] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [Type] nvarchar(100) NOT NULL,
        [Title] nvarchar(300) NOT NULL,
        [Body] nvarchar(1000) NOT NULL,
        [IsRead] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [Services] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Description] nvarchar(1000) NOT NULL,
        [Price] decimal(18,2) NOT NULL,
        [DurationMinutes] int NOT NULL,
        [Category] nvarchar(100) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Services] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE TABLE [StaffMembers] (
        [Id] uniqueidentifier NOT NULL,
        [BarberShopId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Role] nvarchar(100) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Phone] nvarchar(50) NOT NULL,
        [Bio] nvarchar(1000) NOT NULL,
        [IsActive] bit NOT NULL,
        [WorkingHoursJson] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_StaffMembers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_BarberShopId] ON [Appointments] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Appointments_BarberShopId_ScheduledAt] ON [Appointments] ([BarberShopId], [ScheduledAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_BusinessProfiles_BarberShopId] ON [BusinessProfiles] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Clients_BarberShopId] ON [Clients] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Notifications_BarberShopId] ON [Notifications] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Notifications_BarberShopId_IsRead] ON [Notifications] ([BarberShopId], [IsRead]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Services_BarberShopId] ON [Services] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_StaffMembers_BarberShopId] ON [StaffMembers] ([BarberShopId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260514153218_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260514153218_InitialCreate', N'9.0.5');
END;

COMMIT;
GO

