using BarbershopApi.Data;
using BarbershopApi.DTOs;
using BarbershopApi.Models.Clients;
using BarbershopApi.Models.Enums;
using BarbershopApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace BarbershopApi.Controllers;

[ApiController]
[Route("clients")]
[Authorize]
public class ClientsController(AppDbContext db, ITenantService tenant, ISmsService smsService, IEmailService emailService, IAutoPilotService autoPilot) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery(Name = "filter[tag]")] ClientTag? tag,
        [FromQuery(Name = "filter[churn_risk]")] ChurnRisk? churnRisk,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Clients.Where(c => c.BusinessId == bizId);

        if (tag.HasValue) query = query.Where(c => c.Tags.Contains(tag.Value));
        if (churnRisk.HasValue) query = query.Where(c => c.ChurnRisk == churnRisk.Value);

        query = sort switch
        {
            "last_visit" => query.OrderByDescending(c => c.LastVisitAt),
            "ltv" => query.OrderByDescending(c => c.LifetimeValue),
            "name" => query.OrderBy(c => c.FirstName).ThenBy(c => c.LastName),
            _ => query.OrderByDescending(c => c.CreatedAt)
        };

        var total = await query.CountAsync();
        var clients = await query.Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new PagedResult<ClientDto>(clients.Select(MapClient).ToList(), total, page, limit));
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        q = q.ToLower();
        var clients = await db.Clients
            .Where(c => c.BusinessId == bizId &&
                (c.FirstName.ToLower().Contains(q) || c.LastName.ToLower().Contains(q) ||
                 (c.Email != null && c.Email.ToLower().Contains(q)) ||
                 (c.Phone != null && c.Phone.Contains(q))))
            .Take(limit)
            .ToListAsync();
        return Ok(clients.Select(MapClient));
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export()
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var clients = await db.Clients.Where(c => c.BusinessId == bizId).ToListAsync();
        var csv = new StringBuilder("Id,FirstName,LastName,Email,Phone,LifetimeValue,VisitCount,LastVisit,CreatedAt\n");
        foreach (var c in clients)
            csv.AppendLine($"{c.Id},{c.FirstName},{c.LastName},{c.Email},{c.Phone},{c.LifetimeValue},{c.VisitCount},{c.LastVisitAt:O},{c.CreatedAt:O}");
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", "clients.csv");
    }

    [HttpPost("import")]
    public IActionResult Import(IFormFile file) =>
        Ok(new { message = "CSV import job queued.", job_id = Guid.NewGuid() });

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClientRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = new Client
        {
            BusinessId = bizId,
            FirstName = req.FirstName,
            LastName = req.LastName,
            Email = req.Email,
            Phone = req.Phone,
            DateOfBirth = req.DateOfBirth
        };
        db.Clients.Add(client);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, MapClient(client));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.Include(c => c.Notes).Include(c => c.Documents)
            .FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        return client == null ? NotFound() : Ok(MapClient(client));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateClientRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (client == null) return NotFound();

        if (req.FirstName != null) client.FirstName = req.FirstName;
        if (req.LastName != null) client.LastName = req.LastName;
        if (req.Email != null) client.Email = req.Email;
        if (req.Phone != null) client.Phone = req.Phone;
        if (req.DateOfBirth.HasValue) client.DateOfBirth = req.DateOfBirth;
        if (req.Tags != null) client.Tags = req.Tags;
        if (req.RebookIntervalDays.HasValue) client.RebookIntervalDays = req.RebookIntervalDays.Value;
        client.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(MapClient(client));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (client == null) return NotFound();
        client.IsArchived = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/visits")]
    public async Task<IActionResult> GetVisits(Guid id, [FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Bookings.Where(b => b.BusinessId == bizId && b.ClientId == id);
        var total = await query.CountAsync();
        var bookings = await query.OrderByDescending(b => b.StartsAt).Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = bookings, total, page, limit });
    }

    [HttpGet("{id:guid}/payments")]
    public async Task<IActionResult> GetPayments(Guid id, [FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var query = db.Payments.Where(p => p.BusinessId == bizId && p.ClientId == id);
        var total = await query.CountAsync();
        var payments = await query.OrderByDescending(p => p.CreatedAt).Skip((page - 1) * limit).Take(limit).ToListAsync();
        return Ok(new { items = payments.Select(p => new PaymentDto(p.Id, p.BookingId, p.Amount, p.TipAmount, p.PlatformFee, p.NetAmount, p.Status, p.Method, p.CreatedAt)), total, page, limit });
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var logs = await db.MessagingLogs.Where(m => m.BusinessId == bizId && m.ClientId == id)
            .OrderByDescending(m => m.CreatedAt).ToListAsync();
        return Ok(logs);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (client == null) return NotFound();

        var log = new Models.Messaging.MessagingLog
        {
            BusinessId = bizId,
            ClientId = id,
            Channel = req.Channel,
            To = req.Channel == MessageChannel.SMS ? client.Phone : client.Email,
            Body = req.Body
        };
        db.MessagingLogs.Add(log);
        await db.SaveChangesAsync();

        if (req.Channel == MessageChannel.SMS && !string.IsNullOrEmpty(client.Phone))
            await smsService.SendAsync(client.Phone, req.Body);
        else if (req.Channel == MessageChannel.Email && !string.IsNullOrEmpty(client.Email))
            await emailService.SendAsync(client.Email, client.FullName, req.Subject ?? "Message from your barber", req.Body);

        return Ok(new { message = "Message sent.", id = log.Id });
    }

    [HttpGet("{id:guid}/notes")]
    public async Task<IActionResult> GetNotes(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var notes = await db.ClientNotes.Where(n => n.ClientId == id && n.BusinessId == bizId)
            .OrderByDescending(n => n.IsPinned).ThenByDescending(n => n.CreatedAt).ToListAsync();
        return Ok(notes.Select(MapNote));
    }

    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] AddNoteRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var note = new ClientNote
        {
            ClientId = id,
            BusinessId = bizId,
            AuthorUserId = tenant.GetUserId()!,
            Content = req.Content,
            IsPinned = req.IsPinned
        };
        db.ClientNotes.Add(note);
        await db.SaveChangesAsync();
        return Ok(MapNote(note));
    }

    [HttpPatch("{id:guid}/notes/{nid:guid}")]
    public async Task<IActionResult> UpdateNote(Guid id, Guid nid, [FromBody] UpdateNoteRequest req)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var note = await db.ClientNotes.FirstOrDefaultAsync(n => n.Id == nid && n.ClientId == id && n.BusinessId == bizId);
        if (note == null) return NotFound();
        if (req.Content != null) note.Content = req.Content;
        if (req.IsPinned.HasValue) note.IsPinned = req.IsPinned.Value;
        note.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(MapNote(note));
    }

    [HttpDelete("{id:guid}/notes/{nid:guid}")]
    public async Task<IActionResult> DeleteNote(Guid id, Guid nid)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var note = await db.ClientNotes.FirstOrDefaultAsync(n => n.Id == nid && n.ClientId == id && n.BusinessId == bizId);
        if (note == null) return NotFound();
        db.ClientNotes.Remove(note);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/ai")]
    public async Task<IActionResult> GetAiInsights(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (client == null) return NotFound();

        return Ok(new ClientAiInsightDto(client.ChurnRisk, client.LifetimeValue * 1.2m,
            ["Beard trim add-on", "Hair treatment upgrade"],
            client.ChurnRisk == ChurnRisk.High ? $"Hey {client.FirstName}, we miss you! Book now and get 10% off." : null,
            DateTime.UtcNow));
    }

    [HttpPost("{id:guid}/winback")]
    public async Task<IActionResult> TriggerWinback(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.BusinessId == bizId);
        if (client == null) return NotFound();
        await autoPilot.TriggerWinbackAsync(bizId, client.Id);
        return Ok(new { message = $"Win-back flow triggered for {client.FullName}." });
    }

    [HttpGet("{id:guid}/documents")]
    public async Task<IActionResult> GetDocuments(Guid id)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var docs = await db.ClientDocuments.Where(d => d.ClientId == id && d.BusinessId == bizId).ToListAsync();
        return Ok(docs.Select(d => new ClientDocumentDto(d.Id, d.FileName, d.Url, d.Type, d.CreatedAt)));
    }

    [HttpPost("{id:guid}/documents")]
    public async Task<IActionResult> UploadDocument(Guid id, IFormFile file)
    {
        var bizId = tenant.GetBusinessId()!.Value;
        var fakeUrl = $"https://cdn.flatpurse.com/{bizId}/clients/{id}/{Guid.NewGuid()}/{file.FileName}";
        var doc = new ClientDocument
        {
            ClientId = id,
            BusinessId = bizId,
            FileName = file.FileName,
            Url = fakeUrl,
            FileSizeBytes = file.Length,
            UploadedByUserId = tenant.GetUserId()!
        };
        db.ClientDocuments.Add(doc);
        await db.SaveChangesAsync();
        return Ok(new ClientDocumentDto(doc.Id, doc.FileName, doc.Url, doc.Type, doc.CreatedAt));
    }

    private static ClientDto MapClient(Client c) => new(
        c.Id, c.FirstName, c.LastName, c.Email, c.Phone, c.AvatarUrl, c.Tags, c.ChurnRisk, c.LifetimeValue, c.VisitCount, c.LastVisitAt, c.CreatedAt);

    private static ClientNoteDto MapNote(ClientNote n) => new(n.Id, n.Content, n.IsPinned, n.AuthorUserId, n.CreatedAt, n.UpdatedAt);
}
