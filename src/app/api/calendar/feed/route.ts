import { listNotes } from "@/lib/notesRepo";

// 輔助函數：將 YYYY-MM-DD 轉成 YYYYMMDD
function formatDateString(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// 輔助函數：增加一天（用於 iCal 的 DTEND 獨佔設計）
function addOneDay(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr.replace(/-/g, "");
    
    // 使用本地年、月、日構造 Date，加 1 天
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  } catch {
    return dateStr.replace(/-/g, "");
  }
}

// 輔助函數：格式化時間戳記為 UTC 格式 (YYYYMMDDTHHMMSSZ)
function formatDateTimeStamp(isoStr?: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

// 輔助函數：轉義 iCal 特殊字元
function escapeICalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * GET /api/calendar/feed?workspace_id=...
 * 輸出標準 iCalendar 格式行程，以便外部行事曆訂閱
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace_id = searchParams.get("workspace_id") || "";
    if (!workspace_id) {
      return new Response("Missing workspace_id", { status: 400 });
    }

    // 動態加載過去 60 天至未來 365 天之內的記事/行程
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 60);
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + 365);

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    const notes = await listNotes({
      workspace_id,
      from: fromStr,
      to: toStr,
      limit: 1000,
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FamilyTool//NONSGML Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:家庭生活行事曆",
      "X-WR-TIMEZONE:Asia/Taipei",
      "X-PUBLISHED-TTL:PT1H",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ];

    for (const note of notes) {
      const startVal = note.date_from || note.note_date;
      if (!startVal) continue; // 沒有設定日期的記事就不算行事曆事件，跳過
      
      const endVal = note.date_to || startVal;

      const dtStart = formatDateString(startVal);
      const dtEnd = addOneDay(endVal);
      const dtStamp = formatDateTimeStamp(note.created_at);

      const summary = escapeICalText(note.title || "無標題");
      const description = escapeICalText(
        (note.owner ? `【成員：${note.owner}】\n` : "") + (note.content || "")
      );

      ics.push("BEGIN:VEVENT");
      ics.push(`UID:note_${note.id}@familytool`);
      ics.push(`DTSTAMP:${dtStamp}`);
      ics.push(`DTSTART;VALUE=DATE:${dtStart}`);
      ics.push(`DTEND;VALUE=DATE:${dtEnd}`);
      ics.push(`SUMMARY:${summary}`);
      if (description) {
        ics.push(`DESCRIPTION:${description}`);
      }
      ics.push("END:VEVENT");
    }

    ics.push("END:VCALENDAR");
    const icsText = ics.join("\r\n");

    return new Response(icsText, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="family-calendar.ics"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
