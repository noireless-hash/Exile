const { DateTime } = require('luxon');

// Múi giờ mặc định cho Việt Nam (UTC+7)
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Các định dạng giờ phổ biến (bao gồm cả chuẩn 24h, 12h AM/PM và dạng "18h30" của Việt Nam)
const TIME_FORMATS = [
  'HH:mm',
  'H:mm',
  'HH\'h\'mm',  // 18h30
  'H\'h\'mm',   // 6h30
  'HH\'h\'',    // 18h
  'H\'h\'',     // 6h
  'h:mma',
  'h:mm a',
  'ha',
  'h a',
  'hmma',
];

// Parse ngày + giờ theo múi giờ chỉ định (mặc định Asia/Ho_Chi_Minh) ra Unix timestamp (giây)
function parseEventTime(date, time, timezone = DEFAULT_TIMEZONE) {
  const targetTz = timezone || DEFAULT_TIMEZONE;

  if (!DateTime.local().setZone(targetTz).isValid) {
    return {
      ok: false,
      error: `Múi giờ \`${timezone}\` không hợp lệ. Vui lòng sử dụng múi giờ chuẩn IANA như \`Asia/Ho_Chi_Minh\`.`,
    };
  }

  // Chuẩn hóa chuỗi thời gian nhập vào: xóa khoảng trắng dư thừa, đưa về chữ thường
  const cleanTime = String(time || '').trim().replace(/\s+/g, '').toLowerCase();

  let dt;
  for (const fmt of TIME_FORMATS) {
    dt = DateTime.fromFormat(`${date} ${cleanTime}`, `yyyy-MM-dd ${fmt}`, { zone: targetTz });
    if (dt.isValid) break;
  }

  if (!dt || !dt.isValid) {
    return {
      ok: false,
      error:
        'Không thể đọc định dạng ngày/giờ này. Vui lòng nhập ngày theo dạng `YYYY-MM-DD` (VD: `2026-07-05`) ' +
        'và giờ theo dạng `18:00`, `18h30`, `6:30pm` hoặc `6pm`.',
    };
  }

  return { ok: true, ts: Math.floor(dt.toSeconds()) };
}

// Chuyển timestamp unix ngược lại thành ngày & giờ theo múi giờ local (để prefill modal edit)
function formatLocalParts(ts, timezone = DEFAULT_TIMEZONE) {
  const targetTz = timezone || DEFAULT_TIMEZONE;
  const dt = DateTime.fromSeconds(ts, { zone: targetTz });
  if (!dt.isValid) return { date: '', time: '' };
  return { date: dt.toFormat('yyyy-MM-dd'), time: dt.toFormat('HH:mm') };
}

// Discord tự động hiển thị timestamp chuẩn theo múi giờ trên máy/điện thoại của từng thành viên
const discordTime = (ts, style = 'F') => `<t:${ts}:${style}>`;
const discordRelative = (ts) => `<t:${ts}:R>`;

// Tạo đường dẫn "Thêm vào Google Calendar"
function googleCalendarLink({ title, startTs, durationMin = 120, details, location }) {
  const fmt = (s) => DateTime.fromSeconds(s, { zone: 'utc' }).toFormat("yyyyLLdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Event',
    dates: `${fmt(startTs)}/${fmt(startTs + durationMin * 60)}`,
  });
  if (details) params.set('details', details);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Kiểm tra xem chuỗi múi giờ nhập vào có hợp lệ không
function isValidTimezone(tz) {
  return !!tz && DateTime.local().setZone(tz).isValid;
}

module.exports = {
  DEFAULT_TIMEZONE,
  parseEventTime,
  isValidTimezone,
  formatLocalParts,
  discordTime,
  discordRelative,
  googleCalendarLink,
};
