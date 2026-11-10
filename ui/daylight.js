// Use local calendar boundaries so overnight shifts and clock changes follow
// the same local working hours that the user sees in the schedule editor.
export function workdayProgress(now, schedule) {
  const today = new Date(now * 1000);
  function boundary(day, minutes) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + day,
      Math.floor(minutes / 60), minutes % 60);
  }
  let start = boundary(0, 7 * 60);
  let end = boundary(0, 19 * 60);
  if (schedule?.enabled) {
    const overnight = schedule.end < schedule.start;
    let shortest = Infinity;
    for (const day of overnight ? [-1, 0] : [0]) {
      const from = boundary(day, schedule.start);
      if (!schedule.days.includes((from.getDay() + 6) % 7)) continue;
      const to = boundary(day + Number(overnight), schedule.end);
      const distance = Math.max(from - today, today - to, 0);
      if (distance < shortest) {
        start = from;
        end = to;
        shortest = distance;
      }
    }
  }
  return Math.max(0, Math.min(1, (today - start) / (end - start)));
}
