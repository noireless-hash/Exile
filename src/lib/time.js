const { DateTime } = require('luxon');

/**
 * Đọc định dạng giờ linh hoạt (20:00, 20h30, 20h, 8pm, 8:30pm, 8.30)
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase().replace(/\s+/g, '');

  // 1. Dạng 20:30, 20.30 hoặc 8:30
  let match = clean.match(/^(\d{1,2})[:.](\d{2})(am|pm)?$/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const mer = match[3];
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
      return { hour, min };
    }
  }

  // 2. Dạng 20h30, 20h, 8h30
  match = clean.match(/^(\d{1,2})h(\d{2})?$/);
  if (match) {
    const hour = parseInt(match[1], 10);
    const min = match[2] ? parseInt(match[2], 10) : 0;
    if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
      return { hour, min };
    }
  }

  // 3. Dạng 8pm, 8am, 20
  match = clean.match(/^(\d{1,2})(am|pm)?$/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const mer = match[2];
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24) {
      return { hour, min: 0 };
    }
  }

  return null;
}

/**
 * Chuyển đổi ngày & giờ nhập vào thành Millisecond Timestamp chuẩn JS
 */
function parseEventTime(dateStr, timeStr, timezone = 'Asia/Ho_Chi_Minh') {
  const timeParsed = parseTimeString(timeStr);
  if (!timeParsed) {
    return {
      valid: false,
      error: 'Vui lòng nhập giờ hợp lệ (VD: 20:00, 20h30, 8pm, 20h).',
    };
  }

  // Lấy thời gian hiện tại ở múi giờ được cấu hình (Mặc định: Asia/Ho_Chi_Minh)
  let now = DateTime.now().setZone(timezone);

  if (dateStr && dateStr !== 'today') {
    const matchDate = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchDate) {
      now = DateTime.fromObject(
        {
          year: parseInt(matchDate[1], 10),
          month: parseInt(matchDate[2], 10),
          day: parseInt(matchDate[3], 10),
        },
        { zone: timezone }
      );
    }
  }

  const eventDt = now.set({
    hour: timeParsed.hour,
    minute: timeParsed.min,
    second: 0,
    millisecond: 0,
  });

  if (!eventDt.isValid) {
    return { valid: false, error: 'Thời gian không hợp lệ.' };
  }

  return {
    valid: true,
    // ĐÃ SỬA: Trả về Milliseconds (toMillis) để khớp với JS Date/setTimeout
    startTs: eventDt.toMillis(),
  };
}

/**
 * Định dạng Timestamp sang thẻ hiển thị thời gian của Discord (<t:timestamp:style>)
 */
function discordTime(timestamp, style = 't') {
  if (!timestamp) return '';
  // Tự động nhận diện nếu timestamp là Mili-giây thì đổi sang Giây cho Discord
  const seconds = timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp;
  return `<t:${seconds}:${style}>`;
}

/**
 * Tách Unix Timestamp thành Ngày và Giờ cục bộ (dùng cho Edit Modal)
 */
function formatLocalParts(timestamp, timezone = 'Asia/Ho_Chi_Minh') {
  if (!timestamp) return { date: '', time: '' };
  const millis = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const dt = DateTime.fromMillis(millis).setZone(timezone);
  return {
    date: dt.toFormat('yyyy-MM-dd'),
    time: dt.toFormat('HH:mm'),
  };
}

/**
 * Tạo đường dẫn thêm sự kiện vào Google Calendar
 */
function googleCalendarLink({ title, startTs, durationMin = 120, details }) {
  const millis = startTs < 10000000000 ? startTs * 1000 : startTs;
  const startDt = DateTime.fromMillis(millis).toUTC();
  const endDt = startDt.plus({ minutes: durationMin });

  const fmt = (dt) => dt.toFormat("yyyyMMdd'T'HHmmss'Z'");
  const dates = `${fmt(startDt)}/${fmt(endDt)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Albion Online Event',
    dates,
  });

  if (details) params.append('details', details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

module.exports = {
  parseTimeString,
  parseEventTime,
  discordTime,
  formatLocalParts,
  googleCalendarLink,
};
